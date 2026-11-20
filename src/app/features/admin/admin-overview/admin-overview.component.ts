import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, tap } from 'rxjs';

import { KafkaAdminService } from '../../../core/kafka/kafka-admin.service';
import { MqAdminService } from '../../../core/mq/mq-admin.service';
import { isLikelyDlq } from '../../../core/mq/mq-admin.models';
import { ReportService } from '../../../core/report/report.service';
import { ReportRange } from '../../../shared/models/report.model';
import { formatClock, formatCount } from '../../reports/report-format';
import { RankingItem, ReportRankingComponent } from '../../reports/report-ranking/report-ranking.component';
import { ReportTrendChartComponent } from '../../reports/report-trend-chart/report-trend-chart.component';
import {
  HomeOpsSnapshot,
  openTotal,
  toOpsTiles,
  toPerfMetrics,
  toStatusRows,
} from '../../home/home-kpis/home-ops-tiles';

export type AdminNavSection = 'catalog' | 'rabbitmq' | 'kafka';

type ReachTone = 'ok' | 'error' | 'unknown';

interface ReachTile {
  id: string;
  label: string;
  tone: ReachTone;
  detail: string;
  action?: AdminNavSection;
}

const RANGE: ReportRange = 'last24h';

/**
 * Panel de control de /admin: trámites (report) + alcance de mensajería (mq/kafka) + catálogo.
 * No inventa series de resoluciones ni health APM: solo lo que los endpoints actuales exponen.
 */
@Component({
  selector: 'app-admin-overview',
  imports: [
    MatButton,
    MatIcon,
    MatProgressSpinner,
    ReportRankingComponent,
    ReportTrendChartComponent,
    RouterLink,
  ],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent implements OnInit {
  private readonly report = inject(ReportService);
  private readonly mq = inject(MqAdminService);
  private readonly kafka = inject(KafkaAdminService);

  readonly openSection = output<AdminNavSection>();

  protected readonly formatClock = formatClock;
  protected readonly formatCount = formatCount;
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly fetchedAt = signal<Date | null>(null);
  protected readonly ops = signal<HomeOpsSnapshot | null>(null);
  protected readonly topItems = signal<RankingItem[]>([]);
  protected readonly reach = signal<ReachTile[]>([]);
  protected readonly mqReady = signal(0);
  protected readonly mqUnacked = signal(0);
  protected readonly mqDlq = signal(0);
  protected readonly kafkaTopics = signal(0);
  protected readonly kafkaGroups = signal(0);

  protected readonly tiles = computed(() => {
    const snap = this.ops();
    return snap ? toOpsTiles(snap) : [];
  });
  protected readonly statusRows = computed(() => {
    const snap = this.ops();
    return snap ? toStatusRows(snap.kpis) : [];
  });
  protected readonly statusMax = computed(() =>
    Math.max(1, ...this.statusRows().map((row) => row.count)),
  );
  protected readonly openCount = computed(() => {
    const snap = this.ops();
    return snap ? openTotal(snap.kpis) : 0;
  });
  protected readonly perf = computed(() => {
    const snap = this.ops();
    return snap ? toPerfMetrics(snap.kpis) : [];
  });
  protected readonly statusRanking = computed<RankingItem[]>(() => {
    const total = this.openCount();
    return this.statusRows().map((row) => ({
      label: row.label,
      value: row.count,
      title:
        total > 0
          ? `${row.count} · ${Math.round((row.count / total) * 100)}% de abiertos`
          : undefined,
    }));
  });
  protected readonly hasIncomeActivity = computed(() => {
    const snap = this.ops();
    if (!snap) {
      return false;
    }
    return snap.kpis.requestsOverTime.points.some((point) => point.count > 0);
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loadState.set('loading');
    forkJoin({
      kpis: this.report.getKpis(RANGE).pipe(catchError(() => of(null))),
      overdue: this.report
        .getSlaAlerts({ status: ['VENCIDO'], page: 0, size: 1 })
        .pipe(catchError(() => of(null))),
      top: this.report.getTopProcedures(RANGE, 8).pipe(catchError(() => of(null))),
      queues: this.mq.listQueues().pipe(catchError(() => of(null))),
      topics: this.kafka.listTopics().pipe(catchError(() => of(null))),
      groups: this.kafka.listConsumerGroups().pipe(catchError(() => of(null))),
    })
      .pipe(
        tap((bundle) => {
          const reach: ReachTile[] = [
            {
              id: 'report',
              label: 'Report',
              tone: bundle.kpis ? 'ok' : 'error',
              detail: bundle.kpis
                ? 'KPIs y series de ingresos responden'
                : 'No responde GET /api/report/kpis',
            },
            {
              id: 'catalog',
              label: 'Catalog',
              tone: 'unknown',
              detail: 'Gestión de tipos en la pestaña Catálogo (sin sondeo duplicado aquí)',
              action: 'catalog',
            },
            {
              id: 'mq',
              label: 'RabbitMQ (mq-admin)',
              tone: bundle.queues ? 'ok' : 'error',
              detail: bundle.queues
                ? `${bundle.queues.length} colas consultadas`
                : 'No responde GET /api/mq/queues',
              action: 'rabbitmq',
            },
            {
              id: 'kafka',
              label: 'Kafka (kafka-admin)',
              tone:
                bundle.topics && bundle.groups
                  ? 'ok'
                  : bundle.topics || bundle.groups
                    ? 'unknown'
                    : 'error',
              detail:
                bundle.topics && bundle.groups
                  ? `${bundle.topics.length} topics · ${bundle.groups.length} grupos`
                  : 'Respuesta parcial o nula de topics/grupos',
              action: 'kafka',
            },
          ];

          if (bundle.kpis && bundle.overdue) {
            this.ops.set({ kpis: bundle.kpis, overdue: bundle.overdue });
          } else {
            this.ops.set(null);
          }

          this.topItems.set(
            (bundle.top?.items ?? []).slice(0, 8).map((item) => ({
              label: item.procedureLabel ?? item.procedureType,
              value: item.count,
            })),
          );

          if (bundle.queues) {
            this.mqReady.set(bundle.queues.reduce((s, q) => s + (q.messagesReady ?? 0), 0));
            this.mqUnacked.set(bundle.queues.reduce((s, q) => s + (q.messagesUnacked ?? 0), 0));
            this.mqDlq.set(
              bundle.queues.filter(isLikelyDlq).reduce((s, q) => s + q.messages, 0),
            );
          } else {
            this.mqReady.set(0);
            this.mqUnacked.set(0);
            this.mqDlq.set(0);
          }
          this.kafkaTopics.set(
            bundle.topics?.filter((topic) => !topic.name.endsWith('.DLT')).length ?? 0,
          );
          this.kafkaGroups.set(bundle.groups?.length ?? 0);
          this.reach.set(reach);
          this.fetchedAt.set(new Date());

          const criticalOk = !!bundle.kpis || !!bundle.queues || !!bundle.topics;
          this.loadState.set(criticalOk ? 'ready' : 'error');
        }),
      )
      .subscribe();
  }

  protected go(section: AdminNavSection): void {
    this.openSection.emit(section);
  }
}
