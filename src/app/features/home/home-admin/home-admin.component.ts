import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SlaAlertQuery } from '../../../shared/models/report.model';
import { HomeDemandBlockComponent } from '../home-demand-block/home-demand-block.component';
import { HomeKpisComponent } from '../home-kpis/home-kpis.component';
import { HomePlatformStripComponent } from '../home-platform-strip/home-platform-strip.component';
import { HomeQueueBlockComponent } from '../home-queue-block/home-queue-block.component';
import { HomeSlaBlockComponent } from '../home-sla-block/home-sla-block.component';

/**
 * Inicio del Admin: supervisión operativa de la comuna y señales técnicas reales.
 * No copia los KPIs analíticos de /reports. Asignar se hace desde el listado o el detalle.
 */
@Component({
  selector: 'app-home-admin',
  imports: [
    HomeDemandBlockComponent,
    HomeKpisComponent,
    HomePlatformStripComponent,
    HomeQueueBlockComponent,
    HomeSlaBlockComponent,
  ],
  template: `
    <p class="home-admin__lead">
      Resumen general de la operación municipal y el estado de BarrioDigital.
    </p>
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
    <app-home-demand-block />
    <app-home-platform-strip />
  `,
  styleUrls: ['../home-grid.scss', './home-admin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAdminComponent {
  protected readonly slaFilter: Pick<SlaAlertQuery, 'status'> = { status: ['VENCIDO'] };
}
