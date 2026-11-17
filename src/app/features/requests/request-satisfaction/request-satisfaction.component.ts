import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { Request } from '../../../shared/models/request.model';
import { RequestsService } from '../requests.service';

const SCORES = [
  { value: 1, label: 'Muy insatisfactoria', short: '1', tone: 'red' },
  { value: 2, label: 'Insatisfactoria', short: '2', tone: 'orange' },
  { value: 3, label: 'Regular', short: '3', tone: 'yellow' },
  { value: 4, label: 'Satisfactoria', short: '4', tone: 'green-dark' },
  { value: 5, label: 'Muy satisfactoria', short: '5', tone: 'green-light' },
] as const;

/** Motivos frecuentes cuando la nota es baja; se envían juntos en comment (EP3-74). */
const LOW_REASONS = [
  'Demoró demasiado',
  'No resolvieron el problema',
  'Mala comunicación',
  'Trato inadecuado',
  'Información confusa',
] as const;

const COMMENT_MAX = 500;
/** 1 y 2 piden motivo; 3–5 el comentario sigue opcional. */
const LOW_SCORE_MAX = 2;

/** Encuesta del titular en un trámite RESUELTO (EP3-78 / EP3-74). Una sola vez. */
@Component({
  selector: 'app-request-satisfaction',
  imports: [FormsModule, MatButton, MatFormField, MatHint, MatInput, MatLabel, MatProgressSpinner],
  templateUrl: './request-satisfaction.component.html',
  styleUrl: './request-satisfaction.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestSatisfactionComponent {
  private readonly requests = inject(RequestsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestId = input.required<string>();
  readonly rated = output<Request>();

  protected readonly scores = SCORES;
  protected readonly lowReasons = LOW_REASONS;
  protected readonly commentMax = COMMENT_MAX;
  protected readonly score = signal<number | null>(null);
  protected readonly selectedReasons = signal<readonly string[]>([]);
  protected readonly otherSelected = signal(false);
  protected readonly otherText = signal('');
  protected readonly comment = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly needsReasons = computed(() => {
    const score = this.score();
    return score != null && score <= LOW_SCORE_MAX;
  });

  protected readonly selectedLabel = computed(() => {
    const score = this.score();
    if (score == null) {
      return null;
    }
    return SCORES.find((item) => item.value === score)?.label ?? null;
  });

  protected readonly canSubmit = computed(() => {
    if (this.saving() || this.score() == null) {
      return false;
    }
    if (!this.needsReasons()) {
      return true;
    }
    const hasChip = this.selectedReasons().length > 0;
    const other = this.otherSelected() && this.otherText().trim().length > 0;
    return hasChip || other;
  });

  protected selectScore(value: number): void {
    if (this.saving()) {
      return;
    }
    this.score.set(value);
    this.error.set(null);
    if (value > LOW_SCORE_MAX) {
      this.selectedReasons.set([]);
      this.otherSelected.set(false);
      this.otherText.set('');
    }
  }

  protected toggleReason(reason: string): void {
    if (this.saving()) {
      return;
    }
    const current = this.selectedReasons();
    this.selectedReasons.set(
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason],
    );
    this.error.set(null);
  }

  protected toggleOther(): void {
    if (this.saving()) {
      return;
    }
    const next = !this.otherSelected();
    this.otherSelected.set(next);
    if (!next) {
      this.otherText.set('');
    }
    this.error.set(null);
  }

  protected isReasonSelected(reason: string): boolean {
    return this.selectedReasons().includes(reason);
  }

  protected submit(): void {
    const score = this.score();
    if (score == null || this.saving()) {
      this.error.set('Elige una nota del 1 al 5.');
      return;
    }
    const comment = this.buildComment(score);
    if (this.needsReasons() && !comment) {
      this.error.set('Indica al menos una razón o completa Otros.');
      return;
    }
    if (comment.length > COMMENT_MAX) {
      this.error.set(`El comentario no puede superar ${COMMENT_MAX} caracteres.`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const payload = comment ? { score, comment } : { score };
    this.requests
      .rate(this.requestId(), payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => {
          this.saving.set(false);
          this.rated.emit(request);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(rateFailure(err));
        },
      });
  }

  private buildComment(score: number): string {
    if (score > LOW_SCORE_MAX) {
      return this.comment().trim();
    }
    const parts = [...this.selectedReasons()];
    const other = this.otherText().trim();
    if (this.otherSelected() && other) {
      parts.push(`Otros: ${other}`);
    }
    return parts.join('; ');
  }
}

function rateFailure(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'No pudimos guardar tu calificación. Inténtalo nuevamente.';
  }
  const message = typeof error.error?.message === 'string' ? error.error.message.trim() : '';
  if (message && !/ORA-\d+|SQL\b|constraint/i.test(message)) {
    if (error.status === 409 || error.status === 400 || error.status === 403) {
      return message;
    }
  }
  switch (error.status) {
    case 0:
      return 'No pudimos guardar tu calificación. Revisa tu conexión e inténtalo nuevamente.';
    case 401:
      return 'Tu sesión ya no permite calificar. Inicia sesión nuevamente.';
    case 403:
      return 'No tienes permiso para calificar este trámite.';
    case 404:
      return 'El trámite ya no está disponible.';
    case 409:
      return 'Este trámite ya no se puede calificar.';
    default:
      return 'No pudimos guardar tu calificación. Inténtalo nuevamente.';
  }
}
