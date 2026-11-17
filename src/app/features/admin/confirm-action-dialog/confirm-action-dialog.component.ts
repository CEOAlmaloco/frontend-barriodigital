import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';

export interface ConfirmActionDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** Confirmación genérica antes de vaciar, borrar o reenviar en el panel de mensajería. */
@Component({
  selector: 'app-confirm-action-dialog',
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Cancelar</button>
      <button
        matButton="filled"
        type="button"
        [attr.data-danger]="data.danger ? true : null"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel || 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0;
      line-height: 1.5;
      max-width: 40rem;
    }
    button[data-danger='true'] {
      --mat-filled-button-container-color: var(--bd-error);
      --mat-filled-button-label-text-color: var(--bd-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmActionDialogComponent {
  protected readonly data = inject<ConfirmActionDialogData>(MAT_DIALOG_DATA);
}
