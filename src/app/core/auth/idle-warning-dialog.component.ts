import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
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
    <h2 mat-dialog-title>Tu sesión se cerrará pronto</h2>
    <mat-dialog-content>
      <p>Por seguridad, la sesión se cierra tras un tiempo sin actividad.</p>
      <p>
        Tiempo restante: <strong>{{ timeLeft() }}</strong>
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" (click)="continueSession()">
        Seguir trabajando
      </button>
    </mat-dialog-actions>
  `,
})
export class IdleWarningDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(
    MatDialogRef<IdleWarningDialogComponent, 'continue' | 'timeout'>,
  );
  private readonly data = inject<IdleWarningData>(MAT_DIALOG_DATA);

  protected readonly secondsLeft = signal(this.data.secondsLeft);
  protected readonly timeLeft = computed(() => {
    const seconds = this.secondsLeft();
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
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
