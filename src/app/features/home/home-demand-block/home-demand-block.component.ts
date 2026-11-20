import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { ReportService } from '../../../core/report/report.service';
import { ProcedureType } from '../../../shared/models/procedure-type.model';
import { ReportRange, ReportTopProcedures, TopProcedure } from '../../../shared/models/report.model';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import { formatCount } from '../../reports/report-format';
import { RankingItem, ReportRankingComponent } from '../../reports/report-ranking/report-ranking.component';
import { blockView, readyData } from '../home-block-view';
import { HomeBlockComponent } from '../home-block/home-block.component';

const RANGE: ReportRange = 'last24h';

interface DemandSnapshot {
  top: ReportTopProcedures;
  catalog: ProcedureType[];
}

type QuotaTone = 'ok' | 'low' | 'none' | 'unlimited' | 'inactive';

interface QuotaRow {
  value: string;
  label: string;
  detail: string;
  tone: QuotaTone;
}

function quotaRow(type: ProcedureType): QuotaRow {
  if (!type.active) {
    return { value: type.value, label: type.label, detail: 'Inactivo', tone: 'inactive' };
  }
  if (type.dailyQuota == null) {
    return { value: type.value, label: type.label, detail: 'Cupo ilimitado', tone: 'unlimited' };
  }
  const remaining = type.remainingQuota ?? 0;
  if (remaining <= 0) {
    return {
      value: type.value,
      label: type.label,
      detail: `Agotado · ${formatCount(type.dailyQuota)} / día`,
      tone: 'none',
    };
  }
  return {
    value: type.value,
    label: type.label,
    detail: `${formatCount(remaining)} de ${formatCount(type.dailyQuota)} disponibles`,
    tone: remaining <= Math.ceil(type.dailyQuota * 0.2) ? 'low' : 'ok',
  };
}

/** Demanda del período (top tipos) y cupos actuales del catálogo. */
@Component({
  selector: 'app-home-demand-block',
  imports: [HomeBlockComponent, MatIcon, ReportRankingComponent, RouterLink],
  template: `
    <app-home-block
      headingId="home-demand"
      heading="Demanda y cupos"
      description="Tipos más ingresados en las últimas 24 horas y disponibilidad de cupo"
      service="reportes"
      [view]="view()"
      [empty]="false"
      (refresh)="source.refresh()"
    >
      <div class="demand">
        <div class="demand__panel">
          <h3 id="home-demand-top">Más demandados</h3>
          @if (ranking().length > 0) {
            <app-report-ranking
              [items]="ranking()"
              [ordered]="true"
              labelledBy="home-demand-top"
            />
          } @else {
            <p class="demand__empty">No ingresaron trámites en las últimas 24 horas.</p>
          }
        </div>
        <div class="demand__panel">
          <h3 id="home-demand-quota">Cupos del catálogo</h3>
          @if (quotas().length > 0) {
            <ul class="demand__quotas" aria-labelledby="home-demand-quota">
              @for (row of quotas(); track row.value) {
                <li [class]="'demand__quota demand__quota--' + row.tone">
                  <span class="demand__quota-label">{{ row.label }}</span>
                  <span class="demand__quota-detail">{{ row.detail }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="demand__empty">Sin tipos de trámite en el catálogo.</p>
          }
        </div>
      </div>
      <a homeBlockFooter class="home-link" routerLink="/admin">
        Administrar catálogo<mat-icon aria-hidden="true">arrow_forward</mat-icon>
      </a>
    </app-home-block>
  `,
  styleUrls: ['./home-demand-block.component.scss', '../home-link.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeDemandBlockComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly catalogService = inject(CatalogService);

  protected readonly source = loadedResource<number, DemandSnapshot>({
    key: 0,
    load: () =>
      forkJoin({
        top: this.reportService.getTopProcedures(RANGE, 5),
        catalog: this.catalogService.getProcedures(),
      }).pipe(map((snapshot) => snapshot)),
  });
  protected readonly view = computed(() => blockView(this.source.state(), this.source.key()));
  protected readonly data = computed(() => readyData(this.view()));
  protected readonly ranking = computed<RankingItem[]>(() => {
    const items = this.data()?.top.items ?? [];
    return items.map((item: TopProcedure) => ({
      label: item.procedureLabel ?? item.procedureType,
      value: item.count,
    }));
  });
  protected readonly quotas = computed(() => {
    const catalog = this.data()?.catalog ?? [];
    return catalog
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
      .slice(0, 8)
      .map(quotaRow);
  });

  ngOnInit(): void {
    this.source.setKey(0);
  }
}
