import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Motivo con que el Admin intervino un trámite; es lo que el Auditor fiscaliza (EP3-04, sección 6.3). */
@Component({
  selector: 'app-audit-intervention',
  imports: [MatIcon],
  template: `
    <mat-icon aria-hidden="true">shield</mat-icon>
    <p><strong>Motivo de la intervención del Administrador:</strong> {{ reason() }}</p>
  `,
  styleUrl: './audit-intervention.component.scss',
  host: { role: 'note' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditInterventionComponent {
  readonly reason = input.required<string>();
}
