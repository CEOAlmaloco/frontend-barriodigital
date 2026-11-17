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
import {
  ConfirmActionDialogComponent,
  type ConfirmActionDialogData,
} from '../confirm-action-dialog/confirm-action-dialog.component';

@Component({
  selector: 'app-admin-mq-panel',
  imports: [MatButton, MatIconButton, MatIcon, MatProgressSpinner, MatTableModule, MatTooltip],
  templateUrl: './admin-mq-panel.component.html',
  styleUrl: './admin-mq-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMqPanelComponent {
  private readonly mq = inject(MqAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = [
    'name',
    'ready',
    'unacked',
    'messages',
    'consumers',
    'ttl',
    'deadLetter',
    'acciones',
  ] as const;
  protected readonly queues = signal<MqQueue[]>([]);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busyName = signal<string | null>(null);
  protected readonly onlyWithMessages = signal(false);
  protected readonly onlyDlq = signal(false);
  protected readonly detail = signal<MqQueue | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly formatRate = formatRate;
  protected readonly formatBytes = formatBytes;

  protected readonly visibleQueues = computed(() => {
    let list = this.queues();
    if (this.onlyWithMessages()) {
      list = list.filter((queue) => queue.messages > 0);
    }
    if (this.onlyDlq()) {
      list = list.filter((queue) => isLikelyDlq(queue));
    }
    return list;
  });

  protected readonly messageTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + queue.messages, 0),
  );
  protected readonly readyTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + (queue.messagesReady ?? 0), 0),
  );
  protected readonly unackedTotal = computed(() =>
    this.queues().reduce((sum, queue) => sum + (queue.messagesUnacked ?? 0), 0),
  );
  protected readonly dlqMessageTotal = computed(() =>
    this.queues()
      .filter((queue) => isLikelyDlq(queue))
      .reduce((sum, queue) => sum + queue.messages, 0),
  );
  protected readonly stuckQueues = computed(
    () => this.queues().filter((queue) => queue.messages > 0 && queue.consumers === 0).length,
  );

  constructor() {
    this.reload();
  }

  protected isDlq(queue: MqQueue): boolean {
    return isLikelyDlq(queue);
  }

  protected reload(): void {
    this.loadState.set('loading');
    this.mq
      .listQueues()
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((queues) => {
        if (queues) {
          this.queues.set(queues);
          this.loadState.set('ready');
        } else {
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
            this.reload();
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
            this.reload();
          }
        });
    });
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
