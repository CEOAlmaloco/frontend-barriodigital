import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { ImageSelection } from '../image-selection';
import { RequestImageFieldComponent } from '../request-image-field/request-image-field.component';
import { COMMENT_MAX_LENGTH } from '../requests.constants';
import { RequestActivity, RequestsService } from '../requests.service';

/** Error que cambia lo que el trámite permite: quien muestra el formulario lo cierra y recarga el trámite. */
export interface CommentFailure {
  message: string;
  requiresReload: boolean;
}

/** Desde cuántos comentarios disponibles se muestra cuántos quedan. */
const REMAINING_NOTICE = 5;

let nextId = 0;

@Component({
  selector: 'app-request-comment-form',
  imports: [
    MatButton,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressSpinner,
    ReactiveFormsModule,
    RequestImageFieldComponent,
  ],
  templateUrl: './request-comment-form.component.html',
  styleUrl: './request-comment-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestCommentFormComponent {
  private readonly requests = inject(RequestsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly textArea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textArea');
  private readonly formDirective = viewChild.required(FormGroupDirective);

  readonly requestId = input.required<string>();
  /** Comentarios que el trámite todavía admite, contando este. */
  readonly remaining = input.required<number>();
  readonly saved = output<RequestActivity>();
  readonly failed = output<CommentFailure>();
  readonly cancelled = output<void>();

  protected readonly titleId = `comment-form-title-${nextId++}`;
  protected readonly maxLength = COMMENT_MAX_LENGTH;
  protected readonly remainingNotice = REMAINING_NOTICE;
  protected readonly image = new ImageSelection();
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly text = new FormControl('', {
    nonNullable: true,
    validators: [trimmedRequired, Validators.maxLength(COMMENT_MAX_LENGTH)],
  });
  protected readonly form = new FormGroup({ text: this.text });

  constructor() {
    afterNextRender(() => this.textArea().nativeElement.focus());
  }

  protected selectImage(file: File): void {
    this.saveError.set(null);
    void this.image.select(file);
  }

  protected removeImage(): void {
    this.saveError.set(null);
    this.image.clear();
  }

  protected submit(): void {
    if (this.saving() || this.image.processing() || this.image.error()) {
      return;
    }
    if (this.text.invalid) {
      this.text.markAsTouched();
      this.textArea().nativeElement.focus();
      return;
    }
    const attachment = this.image.file();
    this.saving.set(true);
    this.saveError.set(null);
    this.requests
      .addComment(this.requestId(), this.text.value.trim(), attachment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activity) => {
          this.saving.set(false);
          // Sin reiniciar la directiva, el formulario seguiría "enviado" y mostraría el error del texto vacío
          this.formDirective().resetForm({ text: '' });
          this.image.clear();
          this.saved.emit(activity);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const failure = commentFailure(error, attachment !== null);
          if (failure.target === 'image') {
            this.image.reject(failure.message);
          } else {
            this.saveError.set(failure.message);
          }
          this.failed.emit({ message: failure.message, requiresReload: failure.requiresReload });
        },
      });
  }
}

function trimmedRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

/**
 * requests no tiene códigos estables para el comentario. Un 400 puede venir del texto, del cuerpo o de la imagen,
 * así que se muestra en el formulario; solo el 413 se atribuye al archivo.
 */
export function commentFailure(
  error: unknown,
  withImage: boolean,
): CommentFailure & { target: 'form' | 'image' } {
  const generic = {
    message: 'No se pudo enviar el comentario. Inténtalo de nuevo.',
    requiresReload: false,
    target: 'form' as const,
  };
  if (!(error instanceof HttpErrorResponse)) {
    return generic;
  }
  switch (error.status) {
    case 0:
      return {
        ...generic,
        message: 'No se pudo enviar el comentario. Revisa tu conexión e inténtalo de nuevo.',
      };
    case 400:
      return {
        ...generic,
        message: withImage
          ? 'No se pudo enviar el comentario. Revisa el texto o prueba con otra imagen.'
          : 'No se pudo enviar el comentario. Revisa el texto e inténtalo de nuevo.',
      };
    case 413:
      return {
        message: 'La imagen supera el tamaño permitido. Elige otra o quítala.',
        requiresReload: false,
        target: 'image',
      };
    case 403:
      return {
        ...generic,
        message: 'Tu cuenta no puede comentar este trámite.',
        requiresReload: true,
      };
    case 404:
      return { ...generic, message: 'El trámite ya no está disponible.', requiresReload: true };
    case 409:
      return { ...generic, message: 'El trámite ya no admite comentarios.', requiresReload: true };
    case 503:
      return {
        ...generic,
        message: 'El servicio de trámites no responde. Inténtalo en unos minutos.',
      };
    default:
      return generic;
  }
}
