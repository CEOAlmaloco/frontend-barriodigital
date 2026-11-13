import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { startWith } from 'rxjs';

import { Assignee, Request } from '../../../shared/models/request.model';
import { personInitials } from '../../../shared/utils/person-initials';
import { assignmentFailure } from '../assignment-errors';
import { RequestAssigneeComponent } from '../request-assignee/request-assignee.component';
import { ASSIGNMENT_REASON_MAX_LENGTH } from '../requests.constants';
import { RequestsService } from '../requests.service';

export interface RequestAssignDialogData {
  request: Request;
  procedureTypeLabel: string;
  /** oid de quien asigna, para marcarlo como "Tú" en la lista. */
  currentUserId: string | null;
}

export type RequestAssignDialogResult =
  { kind: 'saved'; request: Request; reassigned: boolean } | { kind: 'reload'; message: string };

type Notice = { tone: 'warning' | 'error'; message: string };

function isAssignee(control: AbstractControl): ValidationErrors | null {
  const value = control.value as Assignee | string | null;
  return value && typeof value === 'object' ? null : { required: true };
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** Sin tildes ni mayúsculas, para que "nanco" encuentre "Ñanco" y "pinon" a "Piñón". */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-CL').trim();
}

/**
 * Asigna o reasigna el responsable (EP3-05, sección 3.2). El motivo existe solo al reasignar:
 * en una primera asignación el backend lo ignora, así que el campo no se muestra.
 */
@Component({
  selector: 'app-request-assign-dialog',
  imports: [
    MatAutocompleteModule,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressSpinner,
    ReactiveFormsModule,
    RequestAssigneeComponent,
  ],
  templateUrl: './request-assign-dialog.component.html',
  styleUrl: './request-assign-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestAssignDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<RequestAssignDialogComponent, RequestAssignDialogResult>,
  );
  private readonly requestsService = inject(RequestsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');
  private readonly assigneeInput =
    viewChild.required<ElementRef<HTMLInputElement>>('assigneeInput');

  protected readonly data = inject<RequestAssignDialogData>(MAT_DIALOG_DATA);
  protected readonly maxReasonLength = ASSIGNMENT_REASON_MAX_LENGTH;
  protected readonly initials = personInitials;

  protected readonly request = signal(this.data.request);
  protected readonly reassign = computed(() => this.request().hasAssignee === true);
  protected readonly title = computed(() =>
    this.reassign() ? 'Reasignar trámite' : 'Asignar trámite',
  );
  protected readonly currentIsMine = computed(
    () => !!this.data.currentUserId && this.request().assigneeId === this.data.currentUserId,
  );
  protected readonly assignees = signal<Assignee[]>([]);
  protected readonly assigneesState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly isSubmitting = signal(false);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly form = new FormGroup({
    assignee: new FormControl<Assignee | string | null>(null, { validators: isAssignee }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(ASSIGNMENT_REASON_MAX_LENGTH)],
    }),
  });

  private readonly search = toSignal(
    this.form.controls.assignee.valueChanges.pipe(startWith(this.form.controls.assignee.value)),
    { initialValue: null },
  );
  protected readonly reasonLength = toSignal(
    this.form.controls.reason.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );
  protected readonly options = computed(() => {
    const value = this.search();
    const term = typeof value === 'string' ? normalize(value) : '';
    return term
      ? this.assignees().filter((assignee) => normalize(assignee.name).includes(term))
      : this.assignees();
  });

  constructor() {
    this.syncReasonControl();
    this.loadAssignees();
  }

  protected displayName = (value: Assignee | string | null): string =>
    value && typeof value === 'object' ? value.name : (value ?? '');

  protected isCurrent(assignee: Assignee): boolean {
    return assignee.id === this.request().assigneeId;
  }

  protected isSelf(assignee: Assignee): boolean {
    return !!this.data.currentUserId && assignee.id === this.data.currentUserId;
  }

  protected loadAssignees(): void {
    this.assigneesState.set('loading');
    this.requestsService
      .getAssignees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (assignees) => {
          this.assignees.set(assignees);
          this.assigneesState.set('ready');
        },
        error: () => this.assigneesState.set('error'),
      });
  }

  protected cancel(): void {
    if (!this.isSubmitting()) {
      this.dialogRef.close();
    }
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }
    const { assignee: assigneeControl, reason: reasonControl } = this.form.controls;
    this.form.markAllAsTouched();
    const assignee = assigneeControl.value;
    if (!assignee || typeof assignee !== 'object') {
      this.assigneeInput().nativeElement.focus();
      return;
    }
    if (this.isCurrent(assignee)) {
      assigneeControl.setErrors({
        server: 'Esa persona ya es la responsable del trámite. Elige a otra.',
      });
      this.assigneeInput().nativeElement.focus();
      return;
    }
    if (this.reassign() && reasonControl.invalid) {
      this.reasonInput()?.nativeElement.focus();
      return;
    }

    const reassigned = this.reassign();
    this.setSubmitting(true);
    this.notice.set(null);
    this.requestsService
      .assign(this.request().id, {
        assigneeId: assignee.id,
        ...(reassigned ? { reason: reasonControl.value.trim() } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => {
          this.setSubmitting(false);
          this.dialogRef.close({ kind: 'saved', request, reassigned });
        },
        error: (error: unknown) => this.handleFailure(error),
      });
  }

  private handleFailure(error: unknown): void {
    this.setSubmitting(false);
    const failure = assignmentFailure(error, 'assign');

    if (failure.reasonRequired) {
      // Alguien tomó el trámite entretanto: se muestra el responsable nuevo y se pide el motivo
      this.notice.set({ tone: 'warning', message: failure.message });
      this.requestsService
        .getRequest(this.request().id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (request) => {
            this.request.set(request);
            this.syncReasonControl();
            this.focusAfterRender(() => this.reasonInput()?.nativeElement);
          },
          error: () => this.dialogRef.close({ kind: 'reload', message: failure.message }),
        });
      return;
    }
    if (failure.field === 'assignee') {
      this.form.controls.assignee.setErrors({ server: failure.message });
      if (failure.staleAssignees) {
        this.loadAssignees();
      }
      this.assigneeInput().nativeElement.focus();
      return;
    }
    if (failure.field === 'reason') {
      this.form.controls.reason.setErrors({ server: failure.message });
      this.reasonInput()?.nativeElement.focus();
      return;
    }
    if (failure.refresh) {
      this.dialogRef.close({ kind: 'reload', message: failure.message });
      return;
    }
    this.notice.set({ tone: 'error', message: failure.message });
  }

  private setSubmitting(submitting: boolean): void {
    this.isSubmitting.set(submitting);
    this.dialogRef.disableClose = submitting;
    if (submitting) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
      this.syncReasonControl();
    }
  }

  /** El motivo solo se valida al reasignar; en una primera asignación no existe. */
  private syncReasonControl(): void {
    const reason = this.form.controls.reason;
    if (this.reassign()) {
      reason.enable({ emitEvent: false });
    } else {
      reason.disable({ emitEvent: false });
    }
  }

  private focusAfterRender(target: () => HTMLElement | undefined): void {
    afterNextRender(() => target()?.focus(), { injector: this.injector });
  }
}
