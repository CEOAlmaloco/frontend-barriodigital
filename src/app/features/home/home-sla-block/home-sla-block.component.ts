import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';

import { ReportService } from '../../../core/report/report.service';
import { SlaAlertPage, SlaAlertQuery } from '../../../shared/models/report.model';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import { HOME_PAGE_SIZE } from '../home.constants';
import { blockView, readyData } from '../home-block-view';
import { HomeBlockComponent } from '../home-block/home-block.component';
import { HomeSlaListComponent } from '../home-sla-list/home-sla-list.component';
import { HomeStateComponent } from '../home-state/home-state.component';

/**
 * Plazos de report en /inicio. El listado de trámites no se filtra por plazo (EP3-07, sección 4), así que no hay
 * una vista completa a la cual enlazar: el bloque pagina en su lugar.
 */
@Component({
  selector: 'app-home-sla-block',
  imports: [HomeBlockComponent, HomeSlaListComponent, HomeStateComponent, MatPaginator],
  template: `
    <app-home-block
      [headingId]="headingId()"
      [heading]="heading()"
      [description]="description()"
      service="reportes"
      [view]="view()"
      [count]="page()?.totalElements ?? null"
      [alertCount]="true"
      [dataAt]="page()?.lastEventAt ?? null"
      [empty]="page()?.totalElements === 0"
      [footer]="(page()?.totalElements ?? 0) > pageSize"
      (refresh)="source.refresh()"
    >
      <app-home-sla-list
        [alerts]="page()?.content ?? []"
        [showAssignee]="showAssignee()"
        [now]="loadedAt()"
      />
      <app-home-state homeBlockEmpty icon="task_alt" tone="success" [heading]="emptyHeading()" />
      <mat-paginator
        homeBlockFooter
        class="sla-paginator"
        [attr.aria-label]="'Páginas de ' + heading()"
        [length]="page()?.totalElements ?? 0"
        [pageIndex]="source.key()"
        [pageSize]="pageSize"
        [disabled]="source.state().loading"
        hidePageSize
        showFirstLastButtons
        (page)="changePage($event)"
      />
    </app-home-block>
  `,
  styleUrl: './home-sla-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSlaBlockComponent implements OnInit {
  private readonly reportService = inject(ReportService);

  readonly headingId = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
  readonly emptyHeading = input.required<string>();
  readonly filter = input.required<Pick<SlaAlertQuery, 'status' | 'assignee'>>();
  readonly showAssignee = input(false);

  protected readonly pageSize = HOME_PAGE_SIZE;
  protected readonly source = loadedResource<number, SlaAlertPage>({
    key: 0,
    load: (page) =>
      this.reportService.getSlaAlerts({ ...this.filter(), page, size: HOME_PAGE_SIZE }),
  });
  protected readonly view = computed(() => blockView(this.source.state(), this.source.key()));
  protected readonly page = computed(() => readyData(this.view()));
  protected readonly loadedAt = computed(() => this.source.state().fetchedAt ?? new Date());

  constructor() {
    // Si se resolvieron trámites mientras tanto, la página pedida puede quedar fuera del total
    effect(() => {
      const state = this.source.state();
      const data = state.data;
      if (
        data &&
        !state.loading &&
        state.dataKey === this.source.key() &&
        data.content.length === 0 &&
        data.totalElements > 0 &&
        this.source.key() > 0
      ) {
        this.source.setKey(Math.max(Math.ceil(data.totalElements / HOME_PAGE_SIZE) - 1, 0));
      }
    });
  }

  /** La consulta depende de los inputs: no existen todavía en el constructor. */
  ngOnInit(): void {
    this.source.setKey(0);
  }

  protected changePage(event: PageEvent): void {
    this.source.setKey(event.pageIndex);
  }
}
