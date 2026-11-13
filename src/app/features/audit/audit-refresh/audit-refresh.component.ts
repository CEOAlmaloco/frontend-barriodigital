import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * Actualización manual con la hora de la última consulta. Auditoría no consulta sola: un evento nuevo
 * correría las filas mientras alguien revisa un detalle.
 */
@Component({
  selector: 'app-audit-refresh',
  imports: [MatButton, MatIcon],
  template: `
    @if (consultedAt(); as time) {
      <span class="refresh__time"
        >Consultado <strong>{{ time }}</strong></span
      >
    }
    <button matButton="outlined" type="button" [disabled]="loading()" (click)="refresh.emit()">
      <mat-icon aria-hidden="true">refresh</mat-icon>
      Actualizar
    </button>
  `,
  styleUrl: './audit-refresh.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditRefreshComponent {
  /** Hora en Chile, HH:MM:SS. */
  readonly consultedAt = input<string | null>(null);
  readonly loading = input(false);
  readonly refresh = output<void>();
}
