import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { catchError, finalize, map, of } from 'rxjs';

import { MqAdminService } from '../../../core/mq/mq-admin.service';
import {
  formatBytes,
  formatRate,
  isLikelyDlq,
  type MqQueue,
} from '../../../core/mq/mq-admin.models';
import { failureKind } from '../../../shared/utils/http-failure';
import { formatClock } from '../../reports/report-format';
import {
  RankingItem,
  ReportRankingComponent,
} from '../../reports/report-ranking/report-ranking.component';
import {
  AdminRateChartComponent,
  type AdminRateSample,
} from '../admin-rate-chart/admin-rate-chart.component';
import {
  ConfirmActionDialogComponent,
  type ConfirmActionDialogData,
} from '../confirm-action-dialog/confirm-action-dialog.component';

const RATE_SAMPLE_MAX = 24;
const POLL_MS = 5000;

@Component({
  selector: 'app-admin-mq-panel',
  imports: [
    AdminRateChartComponent,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTableModule,
    MatTooltip,
    ReportRankingComponent,
  ],
  templateUrl: './admin-mq-panel.component.html',
  styleUrl: './admin-mq-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMqPanelComponent {
  private readonly mq = inject(MqAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private refreshing = false;

  protected readonly columns = [
    'name',
    'ready',
    'unacked',
    'messages',
    'consumers',
    'publish',
    'ack',
    'ttl',
    'deadLetter',
    'acciones',
  ] as const;
  protected readonly queues = signal<MqQueue[]>([]);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busyName = signal<string | null>(null);
  protected readonly onlyWithMessages = signal(false);
  protected readonly onlyDlq = signal(false);
  protected readonly query = signal('');
  protected readonly detail = signal<MqQueue | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly fetchedAt = signal<Date | null>(null);
  protected readonly autoRefresh = signal(true);
  protected readonly rateSamples = signal<AdminRateSample[]>([]);
  protected readonly formatRate = formatRate;
  protected readonly formatBytes = formatBytes;
  protected readonly formatClock = formatClock;
  protected readonly rateLegend = [
    { key: 'publish', label: 'Publish', color: 'primary' },
    { key: 'deliver', label: 'Deliver', color: 'secondary' },
    { key: 'ack', label: 'ACK', color: 'accent' },
  ] as const;

  protected readonly visibleQueues = computed(() => {
    let list = this.queues();
    if (this.onlyWithMessages()) {
      list = list.filter((queue) => queue.messages > 0);
    }
    if (this.onlyDlq()) {
      list = list.filter((queue) => isLikelyDlq(queue));
    }
    const q = this.query().trim().toLowerCase();
    if (q) {
      list = list.filter((queue) => queue.name.toLowerCase().includes(q));
    }
    return list;
  });

  protected readonly readyTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + (queue.messagesReady ?? 0), 0),
  );
  protected readonly unackedTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + (queue.messagesUnacked ?? 0), 0),
  );
  protected readonly consumersTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + (queue.consumers ?? 0), 0),
  );
  protected readonly dlqMessageTotal = computed(() =>
    this.queues()
      .filter((queue) => isLikelyDlq(queue))
      .reduce((sum, queue) => sum + queue.messages, 0),
  );
  protected readonly stuckQueues = computed(
    () => this.queues().filter((queue) => queue.messages > 0 && queue.consumers === 0).length,
  );
  /** Top colas por Ready (incluye 0 para mantener estructura del panel). */
  protected readonly accumulation = computed<RankingItem[]>(() =>
    [...this.queues()]
      .map((queue) => ({
        label: queue.name,
        value: queue.messagesReady ?? 0,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 8),
  );
  protected readonly dlqRanking = computed<RankingItem[]>(() =>
    this.queues()
      .filter((queue) => isLikelyDlq(queue))
      .map((queue) => ({ label: queue.name, value: queue.messages }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );

  constructor() {
    this.reload(true);
    const timer = setInterval(() => {
      if (this.autoRefresh() && this.loadState() !== 'loading') {
        this.reload(false);
      }
    }, POLL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected isDlq(queue: MqQueue): boolean {
    return isLikelyDlq(queue);
  }

  protected toggleAutoRefresh(): void {
    this.autoRefresh.update((value) => !value);
  }

  /** @param showLoading false = muestreo silencioso (no tapa la UI). */
  protected reload(showLoading = true): void {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    if (showLoading) {
      this.loadState.set('loading');
    }
    this.mq
      .listQueues()
      .pipe(
        catchError((error: unknown) => {
          if (showLoading) {
            this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          }
          return of(null);
        }),
        finalize(() => {
          this.refreshing = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((queues) => {
        if (queues) {
          this.queues.set(queues);
          this.fetchedAt.set(new Date());
          this.pushRateSample(queues);
          this.loadState.set('ready');
        } else if (showLoading) {
          this.loadState.set('error');
        }
      });
  }

  protected toggleOnlyMessages(): void {
    this.onlyWithMessages.update((value) => !value);
  }

  protected toggleOnlyDlq(): void {
    this.onlyDlq.update((value) => !value);
  }

  protected onQuery(value: string): void {
    this.query.set(value);
  }

  protected openDetail(queue: MqQueue): void {
    this.detailLoading.set(true);
    this.detail.set(null);
    this.mq
      .getQueue(queue.name)
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => this.detail.set(detail ?? queue));
  }

  protected closeDetail(): void {
    this.detail.set(null);
  }

  protected purge(queue: MqQueue): void {
    this.confirm({
      title: 'Vaciar cola',
      message: `Se eliminarán ${queue.messages} mensaje(s) de «${queue.name}». Esta acción no se puede deshacer.`,
      confirmLabel: 'Vaciar',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.busyName.set(queue.name);
      this.mq
        .purgeQueue(queue.name)
        .pipe(
          map(() => true),
          catchError((error: unknown) => {
            this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
            return of(false);
          }),
          finalize(() => this.busyName.set(null)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((okResult) => {
          if (okResult) {
            this.snackBar.open(`Cola «${queue.name}» vaciada.`, 'Cerrar', { duration: 4000 });
            this.reload(true);
          }
        });
    });
  }

  protected remove(queue: MqQueue): void {
    this.confirm({
      title: 'Eliminar cola',
      message: `Se borrará la cola «${queue.name}» y sus mensajes. Confirma solo si ya no se usa en producción.`,
      confirmLabel: 'Eliminar',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.busyName.set(queue.name);
      this.mq
        .deleteQueue(queue.name)
        .pipe(
          map(() => true),
          catchError((error: unknown) => {
            this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
            return of(false);
          }),
          finalize(() => this.busyName.set(null)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((okResult) => {
          if (okResult) {
            this.snackBar.open(`Cola «${queue.name}» eliminada.`, 'Cerrar', { duration: 4000 });
            this.reload(true);
          }
        });
    });
  }

  private pushRateSample(queues: MqQueue[]): void {
    const now = new Date();
    const publish = queues.reduce((sum, queue) => sum + (queue.publishRate ?? 0), 0);
    const deliver = queues.reduce((sum, queue) => sum + (queue.deliverRate ?? 0), 0);
    const ack = queues.reduce((sum, queue) => sum + (queue.ackRate ?? 0), 0);
    const sample: AdminRateSample = {
      label: formatClock(now),
      full: now.toISOString(),
      series: [
        { key: 'publish', value: publish },
        { key: 'deliver', value: deliver },
        { key: 'ack', value: ack },
      ],
    };
    this.rateSamples.update((prev) => [...prev, sample].slice(-RATE_SAMPLE_MAX));
  }

  private confirm(data: ConfirmActionDialogData) {
    return this.dialog
      .open<ConfirmActionDialogComponent, ConfirmActionDialogData, boolean>(
        ConfirmActionDialogComponent,
        { data, width: '28rem' },
      )
      .afterClosed();
  }

  private errorMessage(error: unknown): string {
    switch (failureKind(error)) {
      case 'unavailable':
        return 'El servicio de colas no responde. Inténtalo en unos minutos.';
      case 'forbidden':
        return 'No tienes permiso para administrar colas.';
      default:
        return 'No pudimos completar la operación sobre RabbitMQ.';
    }
  }
}
