import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';

export interface IdleWarningData {
  secondsLeft: number;
}

@Component({
  selector: 'app-idle-warning-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Sesión por inactividad</h2>
    <mat-dialog-content>
      <p>
        Por seguridad en equipos compartidos, tu sesión se cerrará en
        <strong>{{ secondsLeft() }} s</strong> si no hay actividad.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" (click)="continueSession()">Seguir trabajando</button>
    </mat-dialog-actions>
  `,
})
export class IdleWarningDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<IdleWarningDialogComponent, 'continue' | 'timeout'>);
  private readonly data = inject<IdleWarningData>(MAT_DIALOG_DATA);

  protected readonly secondsLeft = signal(this.data.secondsLeft);
  private tick?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.tick = setInterval(() => {
      const next = this.secondsLeft() - 1;
      if (next <= 0) {
        this.clearTick();
        this.dialogRef.close('timeout');
        return;
      }
      this.secondsLeft.set(next);
    }, 1000);
  }

  ngOnDestroy(): void {
    this.clearTick();
  }

  protected continueSession(): void {
    this.clearTick();
    this.dialogRef.close('continue');
  }

  private clearTick(): void {
    if (this.tick) {
      clearInterval(this.tick);
      this.tick = undefined;
    }
  }
}
