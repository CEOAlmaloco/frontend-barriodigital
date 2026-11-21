import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, map, of } from 'rxjs';

import { MqAdminService } from '../../../core/mq/mq-admin.service';
import {
  formatBytes,
  formatRate,
  isLikelyDlq,
  isSystemQueue,
  type MqQueue,
} from '../../../core/mq/mq-admin.models';
import { FailureKind, failureKind } from '../../../shared/utils/http-failure';
import { formatClock } from '../../reports/report-format';
import { adminFailureCopy } from '../admin-failure';
import { AdminKpiComponent } from '../admin-kpi/admin-kpi.component';
import { AdminStateComponent } from '../admin-state/admin-state.component';
import {
  ConfirmActionDialogComponent,
  type ConfirmActionDialogData,
} from '../confirm-action-dialog/confirm-action-dialog.component';

type QueueFilter = 'all' | 'with-messages' | 'dlq';

function toQueueFilter(value: string | null): QueueFilter {
  return value === 'with-messages' || value === 'dlq' ? value : 'all';
}

/** Suma solo si todas las colas traen el dato; si falta en alguna, el total no se conoce. */
function knownTotal(values: (number | null | undefined)[]): number | null {
  return values.every((value) => typeof value === 'number')
    ? (values as number[]).reduce((sum, value) => sum + value, 0)
    : null;
}

@Component({
  selector: 'app-admin-mq-panel',
  imports: [
    AdminKpiComponent,
    AdminStateComponent,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
    MatPrefix,
    MatProgressSpinner,
    MatSuffix,
    MatTableModule,
    MatTooltip,
    NgTemplateOutlet,
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
  private readonly detailTemplate = viewChild.required<TemplateRef<unknown>>('queueDetail');

  protected readonly columns = ['name', 'ready', 'unacked', 'consumers', 'deadLetter', 'acciones'];
  protected readonly filters: readonly { value: QueueFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'with-messages', label: 'Con mensajes' },
    { value: 'dlq', label: 'DLQ' },
  ];
  protected readonly queues = signal<MqQueue[]>([]);
  protected readonly hasData = signal(false);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly failure = signal<FailureKind>('generic');
  protected readonly loadFailure = computed(() =>
    adminFailureCopy(this.failure(), {
      unavailable: 'RabbitMQ no está disponible',
      generic: 'No pudimos cargar las colas',
    }),
  );
  protected readonly isRefreshing = signal(false);
  protected readonly fetchedAt = signal<Date | null>(null);
  protected readonly busyName = signal<string | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** En la URL (`?show=`) para que Inicio pueda abrir la sección ya filtrada. */
  protected readonly filter = toSignal(
    this.route.queryParamMap.pipe(map((params) => toQueueFilter(params.get('show')))),
    { initialValue: 'all' as QueueFilter },
  );
  protected readonly query = signal('');
  protected readonly detail = signal<MqQueue | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailFailed = signal(false);
  protected readonly formatRate = formatRate;
  protected readonly formatBytes = formatBytes;
  protected readonly formatClock = formatClock;
  protected readonly isDlq = isLikelyDlq;
  protected readonly isSystem = isSystemQueue;

  protected readonly visibleQueues = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('es');
    return this.queues().filter((queue) => {
      if (this.filter() === 'with-messages' && queue.messages === 0) {
        return false;
      }
      if (this.filter() === 'dlq' && !isLikelyDlq(queue)) {
        return false;
      }
      return !query || queue.name.toLocaleLowerCase('es').includes(query);
    });
  });
  protected readonly isFiltered = computed(
    () => this.query().trim() !== '' || this.filter() !== 'all',
  );
  protected readonly readyTotal = computed(() =>
    knownTotal(this.queues().map((queue) => queue.messagesReady)),
  );
  protected readonly unackedTotal = computed(() =>
    knownTotal(this.queues().map((queue) => queue.messagesUnacked)),
  );
  protected readonly consumersTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + queue.consumers, 0),
  );
  protected readonly dlqMessageTotal = computed(() =>
    this.queues()
      .filter((queue) => isLikelyDlq(queue))
      .reduce((sum, queue) => sum + queue.messages, 0),
  );
  /** Una DLQ no tiene consumidor por diseño: solo cuentan las colas de trabajo. */
  protected readonly stuckQueues = computed(
    () =>
      this.queues().filter(
        (queue) => !isLikelyDlq(queue) && queue.messages > 0 && queue.consumers === 0,
      ).length,
  );

  constructor() {
    this.load();
  }

  protected refresh(): void {
    if (this.loadState() !== 'loading') {
      this.load(true);
    }
  }

  protected clearFilters(): void {
    this.query.set('');
    this.setFilter('all');
  }

  protected setFilter(value: QueueFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { show: value === 'all' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected openDetail(queue: MqQueue): void {
    this.detail.set(queue);
    this.detailFailed.set(false);
    this.detailLoading.set(true);
    this.dialog.open(this.detailTemplate(), {
      panelClass: 'admin-dialog',
      width: '40rem',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-heading',
    });
    this.mq
      .getQueue(queue.name)
      .pipe(
        catchError(() => {
          this.detailFailed.set(true);
          return of(null);
        }),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        if (detail) {
          this.detail.set(detail);
        }
      });
  }

  protected purge(queue: MqQueue): void {
    this.confirm({
      title: 'Vaciar cola',
      message: `Se eliminarán ${queue.messages} ${queue.messages === 1 ? 'mensaje' : 'mensajes'} de «${queue.name}». Esta acción no se puede deshacer.`,
      confirmLabel: 'Vaciar',
      danger: true,
    }).subscribe((ok) => {
      if (ok) {
        this.run(queue, this.mq.purgeQueue(queue.name), `Cola «${queue.name}» vaciada.`);
      }
    });
  }

  protected remove(queue: MqQueue): void {
    this.confirm({
      title: 'Eliminar cola',
      message: `Se eliminará la cola «${queue.name}» con sus mensajes. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    }).subscribe((ok) => {
      if (ok) {
        this.run(queue, this.mq.deleteQueue(queue.name), `Cola «${queue.name}» eliminada.`);
      }
    });
  }

  private load(manual = false): void {
    this.loadState.set('loading');
    this.isRefreshing.set(manual);
    this.mq
      .listQueues()
      .pipe(
        catchError((error: unknown) => {
          this.failure.set(failureKind(error));
          return of(null);
        }),
        finalize(() => this.isRefreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((queues) => {
        if (queues) {
          this.queues.set(queues);
          this.hasData.set(true);
          this.fetchedAt.set(new Date());
          this.loadState.set('ready');
        } else {
          this.loadState.set('error');
        }
      });
  }

  private run(
    queue: MqQueue,
    operation: ReturnType<MqAdminService['purgeQueue']>,
    done: string,
  ): void {
    this.busyName.set(queue.name);
    operation
      .pipe(
        map(() => true),
        catchError((error: unknown) => {
          this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          return of(false);
        }),
        finalize(() => this.busyName.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ok) => {
        if (ok) {
          this.snackBar.open(done, 'Cerrar', { duration: 4000 });
          this.load();
        }
      });
  }

  private confirm(data: ConfirmActionDialogData) {
    return this.dialog
      .open<ConfirmActionDialogComponent, ConfirmActionDialogData, boolean>(
        ConfirmActionDialogComponent,
        { data, width: '28rem', maxWidth: 'calc(100vw - 32px)', panelClass: 'admin-dialog' },
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
