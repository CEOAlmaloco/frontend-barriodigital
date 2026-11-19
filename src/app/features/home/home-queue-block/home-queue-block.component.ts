import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { Page } from '../../../shared/models/page.model';
import { Request } from '../../../shared/models/request.model';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import { RequestsService } from '../../requests/requests.service';
import { HOME_PAGE_SIZE } from '../home.constants';
import { blockView, readyData } from '../home-block-view';
import { HomeBlockComponent } from '../home-block/home-block.component';
import { HomeRequestListComponent } from '../home-request-list/home-request-list.component';
import { HomeStateComponent } from '../home-state/home-state.component';

/** Orden de la bandeja: lo que lleva más tiempo esperando va primero (EP3-04, sección 7). */
const QUEUE_SORT = 'createdAt,asc';

/** Bandeja de staff en /inicio: los abiertos del responsable (`me`) o sin responsable (`none`). */
@Component({
  selector: 'app-home-queue-block',
  imports: [HomeBlockComponent, HomeRequestListComponent, HomeStateComponent, MatIcon, RouterLink],
  template: `
    <app-home-block
      [headingId]="headingId()"
      [heading]="heading()"
      description="Abiertos · Más antiguos primero"
      service="trámites"
      [view]="view()"
      [count]="page()?.totalElements ?? null"
      [empty]="page()?.content?.length === 0"
      (refresh)="source.refresh()"
    >
      <app-home-request-list [requests]="page()?.content ?? []" [now]="loadedAt()" />
      @if (assignee() === 'me') {
        <app-home-state
          homeBlockEmpty
          icon="inbox"
          heading="No tienes trámites asignados"
          message="Toma uno de los trámites sin asignar para atenderlo."
        />
      } @else {
        <app-home-state
          homeBlockEmpty
          icon="task_alt"
          tone="success"
          heading="No hay trámites sin asignar"
        />
      }
      <a
        homeBlockFooter
        class="home-link"
        routerLink="/tramites"
        [queryParams]="{ assignee: assignee(), open: 'true', sort: sort }"
      >
        {{ linkLabel() }}<mat-icon aria-hidden="true">arrow_forward</mat-icon>
      </a>
    </app-home-block>
  `,
  styleUrl: '../home-link.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeQueueBlockComponent implements OnInit {
  private readonly requestsService = inject(RequestsService);

  readonly assignee = input.required<'me' | 'none'>();
  readonly headingId = input.required<string>();
  readonly heading = input.required<string>();
  readonly linkLabel = input.required<string>();

  protected readonly sort = QUEUE_SORT;
  protected readonly source = loadedResource<number, Page<Request>>({
    key: 0,
    load: () =>
      this.requestsService.getRequests({
        assignee: this.assignee(),
        open: 'true',
        sort: QUEUE_SORT,
        size: String(HOME_PAGE_SIZE),
      }),
  });
  protected readonly view = computed(() => blockView(this.source.state(), this.source.key()));
  protected readonly page = computed(() => readyData(this.view()));
  protected readonly loadedAt = computed(() => this.source.state().fetchedAt ?? new Date());

  /** La consulta depende de los inputs: no existen todavía en el constructor. */
  ngOnInit(): void {
    this.source.setKey(0);
  }
}
