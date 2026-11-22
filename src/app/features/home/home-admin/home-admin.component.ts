import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SlaAlertQuery } from '../../../shared/models/report.model';
import { HomeAttentionComponent } from '../home-attention/home-attention.component';
import { HomeKpisComponent } from '../home-kpis/home-kpis.component';
import { HomeQueueBlockComponent } from '../home-queue-block/home-queue-block.component';
import { HomeSlaBlockComponent } from '../home-sla-block/home-sla-block.component';

/**
 * Inicio del Admin: supervisión de la comuna, con lo que requiere atención primero. Asignar se hace desde
 * el listado o el detalle.
 */
@Component({
  selector: 'app-home-admin',
  imports: [
    HomeAttentionComponent,
    HomeKpisComponent,
    HomeQueueBlockComponent,
    HomeSlaBlockComponent,
  ],
  template: `
    <app-home-attention />
    <app-home-kpis />
    <div class="home-grid">
      <app-home-sla-block
        headingId="home-overdue"
        heading="Plazos vencidos"
        description="Toda la comuna"
        emptyHeading="No hay trámites con el plazo vencido"
        [filter]="slaFilter"
        [showAssignee]="true"
      />
      <app-home-queue-block
        assignee="none"
        headingId="home-unassigned"
        heading="Sin asignar"
        linkLabel="Ver trámites sin asignar"
      />
    </div>
  `,
  styleUrl: '../home-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAdminComponent {
  protected readonly slaFilter: Pick<SlaAlertQuery, 'status'> = { status: ['VENCIDO'] };
}
