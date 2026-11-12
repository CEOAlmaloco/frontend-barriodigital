import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, merge } from 'rxjs';
import {
  MAT_DIALOG_DATA,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';

import {
  GestionFailure,
  RequestGestionFormComponent,
} from '../request-gestion-form/request-gestion-form.component';
import { RequestActivity } from '../requests.service';

export interface RequestGestionDialogData {
  requestId: string;
  requireInterventionReason: boolean;
}

export type RequestGestionDialogResult =
  { kind: 'saved'; activity: RequestActivity } | { kind: 'reload' };

@Component({
  selector: 'app-request-gestion-dialog',
  imports: [MatDialogContent, MatDialogTitle, RequestGestionFormComponent],
  template: `
    <h2 mat-dialog-title class="gestion-dialog__title">Registrar gestión</h2>
    <mat-dialog-content class="gestion-dialog__content">
      <app-request-gestion-form
        [requestId]="data.requestId"
        [requireInterventionReason]="data.requireInterventionReason"
        [showTitle]="false"
        [showCancel]="true"
        (registered)="saved($event)"
        (failed)="failed($event)"
        (cancelled)="dialogRef.close(result)"
      />
    </mat-dialog-content>
  `,
  styles: `
    .gestion-dialog__title {
      color: var(--bd-text);
    }

    .gestion-dialog__content {
      padding-bottom: 24px;
      color: var(--bd-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestGestionDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<RequestGestionDialogComponent, RequestGestionDialogResult>,
  );
  protected readonly data = inject<RequestGestionDialogData>(MAT_DIALOG_DATA);
  /** Si el backend avisó que el trámite cambió, al cerrar se recarga aunque no se haya guardado nada. */
  protected result: RequestGestionDialogResult | undefined;

  constructor() {
    this.dialogRef.disableClose = true;
    merge(
      this.dialogRef.backdropClick(),
      this.dialogRef.keydownEvents().pipe(filter((event) => event.key === 'Escape')),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.dialogRef.close(this.result));
  }

  protected saved(activity: RequestActivity): void {
    this.dialogRef.close({ kind: 'saved', activity });
  }

  protected failed(failure: GestionFailure): void {
    if (failure.requiresReload) {
      this.result = { kind: 'reload' };
    }
  }
}
