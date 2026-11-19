import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SlaAlertQuery } from '../../../shared/models/report.model';
import { HomeQueueBlockComponent } from '../home-queue-block/home-queue-block.component';
import { HomeSlaBlockComponent } from '../home-sla-block/home-sla-block.component';

/**
 * Inicio del Funcionario. Los plazos van primero y en su propio bloque: requests no tiene la fecha límite, y
 * cruzar las dos fuentes rompería la paginación (EP3-04, sección 7).
 */
@Component({
  selector: 'app-home-funcionario',
  imports: [HomeQueueBlockComponent, HomeSlaBlockComponent],
  template: `
    <app-home-sla-block
      headingId="home-my-sla"
      heading="Plazos por vencer y vencidos"
      description="De los trámites a mi cargo"
      emptyHeading="Ningún trámite a tu cargo está por vencer ni vencido"
      [filter]="slaFilter"
    />
    <div class="home-grid">
      <app-home-queue-block
        assignee="me"
        headingId="home-mine"
        heading="Mis asignados"
        linkLabel="Ver mis asignados"
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
export class HomeFuncionarioComponent {
  protected readonly slaFilter: Pick<SlaAlertQuery, 'assignee'> = { assignee: 'me' };
}
