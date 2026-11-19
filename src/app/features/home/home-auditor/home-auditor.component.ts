import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuditService } from '../../../core/audit/audit.service';
import { AuditEvent } from '../../../shared/models/audit.model';
import { Page } from '../../../shared/models/page.model';
import { Role } from '../../../shared/models/role';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import {
  AuditEventsQuery,
  DEFAULT_EVENTS_QUERY,
  toEventsApiParams,
  toEventsUrlParams,
} from '../../audit/audit-query';
import { HOME_PAGE_SIZE } from '../home.constants';
import { blockView, readyData } from '../home-block-view';
import { HomeAuditListComponent } from '../home-audit-list/home-audit-list.component';
import { HomeBlockComponent } from '../home-block/home-block.component';
import { HomeStateComponent } from '../home-state/home-state.component';

/**
 * Toda operación del Admin sobre un trámite es una intervención, salvo asignar, que es su función normal
 * (EP3-07, sección 5.4). `period` recent son los últimos 7 días en hora de Chile.
 */
const INTERVENTIONS: AuditEventsQuery = {
  ...DEFAULT_EVENTS_QUERY,
  actorRole: Role.Admin,
  eventTypes: ['request.status-changed', 'request.contact-logged'],
  size: HOME_PAGE_SIZE,
};
const RECENT: AuditEventsQuery = { ...DEFAULT_EVENTS_QUERY, period: 'all', size: HOME_PAGE_SIZE };

/** Inicio del Auditor: solo lectura, con enlaces a /audit con los mismos filtros. */
@Component({
  selector: 'app-home-auditor',
  imports: [HomeAuditListComponent, HomeBlockComponent, HomeStateComponent, MatIcon, RouterLink],
  template: `
    <div class="home-grid home-grid--wide-start">
      <app-home-block
        headingId="home-interventions"
        heading="Intervenciones del Administrador"
        description="Últimos 7 días"
        service="auditoría"
        [view]="interventionsView()"
        [count]="interventionsPage()?.totalElements ?? null"
        [empty]="interventionsPage()?.content?.length === 0"
        (refresh)="interventions.refresh()"
      >
        <app-home-audit-list
          [events]="interventionsPage()?.content ?? []"
          [interventions]="true"
          [now]="interventionsAt()"
        />
        <app-home-state
          homeBlockEmpty
          icon="verified_user"
          tone="success"
          heading="Sin intervenciones en los últimos 7 días"
        />
        <a homeBlockFooter class="home-link" routerLink="/audit" [queryParams]="interventionsLink">
          Ver en Auditoría<mat-icon aria-hidden="true">arrow_forward</mat-icon>
        </a>
      </app-home-block>

      <app-home-block
        headingId="home-recent-events"
        heading="Últimos eventos"
        service="auditoría"
        [view]="recentView()"
        [empty]="recentPage()?.content?.length === 0"
        (refresh)="recent.refresh()"
      >
        <app-home-audit-list [events]="recentPage()?.content ?? []" [now]="recentAt()" />
        <app-home-state homeBlockEmpty icon="history" heading="Aún no hay eventos registrados" />
        <a homeBlockFooter class="home-link" routerLink="/audit" [queryParams]="recentLink">
          Ver todos los eventos<mat-icon aria-hidden="true">arrow_forward</mat-icon>
        </a>
      </app-home-block>
    </div>
  `,
  styleUrls: ['../home-grid.scss', '../home-link.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAuditorComponent {
  private readonly auditService = inject(AuditService);

  // La vista completa abre con su propio tamaño de página, no con el del resumen
  protected readonly interventionsLink = toEventsUrlParams({
    ...INTERVENTIONS,
    size: DEFAULT_EVENTS_QUERY.size,
  });
  protected readonly recentLink = toEventsUrlParams({ ...RECENT, size: DEFAULT_EVENTS_QUERY.size });

  // La ventana de 7 días se calcula en cada consulta: una pestaña abierta de un día para otro no queda atrás
  protected readonly interventions = loadedResource<number, Page<AuditEvent>>({
    key: 0,
    load: () => this.auditService.searchEvents(toEventsApiParams(INTERVENTIONS, new Date())),
  });
  protected readonly recent = loadedResource<number, Page<AuditEvent>>({
    key: 0,
    load: () => this.auditService.searchEvents(toEventsApiParams(RECENT, new Date())),
  });

  protected readonly interventionsView = computed(() =>
    blockView(this.interventions.state(), this.interventions.key()),
  );
  protected readonly recentView = computed(() => blockView(this.recent.state(), this.recent.key()));
  protected readonly interventionsPage = computed(() => readyData(this.interventionsView()));
  protected readonly recentPage = computed(() => readyData(this.recentView()));
  protected readonly interventionsAt = computed(
    () => this.interventions.state().fetchedAt ?? new Date(),
  );
  protected readonly recentAt = computed(() => this.recent.state().fetchedAt ?? new Date());

  constructor() {
    this.interventions.setKey(0);
    this.recent.setKey(0);
  }
}
