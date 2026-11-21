import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { KafkaAdminService } from '../../../core/kafka/kafka-admin.service';
import {
  flattenDltMessages,
  groupLag,
  type KafkaDltMessage,
  type KafkaGroupDetail,
  type KafkaGroupLag,
  type KafkaGroupSummary,
  type KafkaResetOffsetsResponse,
  type KafkaTopicDetail,
  type KafkaTopicSummary,
} from '../../../core/kafka/kafka-admin.models';
import { FailureKind, failureKind } from '../../../shared/utils/http-failure';
import { formatClock } from '../../reports/report-format';
import { RequestDatePipe } from '../../requests/request-date.pipe';
import { adminFailureCopy } from '../admin-failure';
import { AdminKpiComponent } from '../admin-kpi/admin-kpi.component';
import { AdminStateComponent } from '../admin-state/admin-state.component';
import {
  ConfirmActionDialogComponent,
  type ConfirmActionDialogData,
} from '../confirm-action-dialog/confirm-action-dialog.component';

type KafkaView = 'topicos' | 'grupos' | 'dlt';
type TopicHealth = 'ok' | 'degraded' | 'offline' | 'unknown';
type GroupLagState = KafkaGroupLag | 'unknown';

/** Tope de detalles que se piden al cargar: kafka-admin responde uno por tópico o grupo. */
const DETAIL_LIMIT = 30;
const DLT_PAGE = 50;

const GROUP_STATES: Readonly<Record<string, string>> = {
  STABLE: 'Estable',
  EMPTY: 'Sin miembros',
  PREPARING_REBALANCE: 'Rebalanceando',
  COMPLETING_REBALANCE: 'Rebalanceando',
  DEAD: 'Inactivo',
};

function isDlt(name: string): boolean {
  return name.endsWith('.DLT');
}

function topicHealth(detail: KafkaTopicDetail): TopicHealth {
  if (detail.partitions.some((part) => part.leader == null || part.leader < 0)) {
    return 'offline';
  }
  return detail.partitions.some((part) => part.isr.length < part.replicas.length)
    ? 'degraded'
    : 'ok';
}

@Component({
  selector: 'app-admin-kafka-panel',
  imports: [
    AdminKpiComponent,
    AdminStateComponent,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatCheckbox,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatLabel,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    MatMenuTrigger,
    MatOption,
    MatProgressSpinner,
    MatSelect,
    MatTableModule,
    MatTooltip,
    NgTemplateOutlet,
    RequestDatePipe,
  ],
  templateUrl: './admin-kafka-panel.component.html',
  styleUrl: './admin-kafka-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminKafkaPanelComponent {
  private readonly kafka = inject(KafkaAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly topicTemplate = viewChild.required<TemplateRef<unknown>>('topicDetailView');
  private readonly groupTemplate = viewChild.required<TemplateRef<unknown>>('groupDetailView');
  private readonly messageTemplate = viewChild.required<TemplateRef<unknown>>('messageDetailView');

  protected readonly views: readonly { value: KafkaView; label: string }[] = [
    { value: 'topicos', label: 'Tópicos' },
    { value: 'grupos', label: 'Grupos de consumo' },
    { value: 'dlt', label: 'DLT' },
  ];
  protected readonly topicColumns = ['name', 'health', 'partitions', 'replication', 'acciones'];
  protected readonly groupColumns = ['groupId', 'state', 'members', 'lag', 'acciones'];
  protected readonly dltColumns = ['select', 'event', 'origin', 'error', 'receivedAt', 'acciones'];
  protected readonly dltPage = DLT_PAGE;
  protected readonly formatClock = formatClock;

  protected readonly view = signal<KafkaView>('topicos');
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly failure = signal<FailureKind>('generic');
  protected readonly loadFailure = computed(() =>
    adminFailureCopy(this.failure(), {
      unavailable: 'Kafka no está disponible',
      generic: 'No pudimos cargar los tópicos de Kafka',
    }),
  );
  protected readonly hasData = signal(false);
  protected readonly isRefreshing = signal(false);
  protected readonly fetchedAt = signal<Date | null>(null);
  protected readonly busy = signal(false);

  protected readonly topics = signal<KafkaTopicSummary[]>([]);
  protected readonly groups = signal<KafkaGroupSummary[]>([]);
  protected readonly groupsFailed = signal(false);
  protected readonly health = signal<Record<string, TopicHealth> | null>(null);
  protected readonly lags = signal<Record<string, GroupLagState> | null>(null);

  protected readonly topicDetail = signal<KafkaTopicDetail | null>(null);
  protected readonly groupDetail = signal<KafkaGroupDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailFailed = signal(false);
  protected readonly detailTitle = signal('');
  protected readonly resetTopic = signal('');
  protected readonly resetPreview = signal<KafkaResetOffsetsResponse | null>(null);

  protected readonly selectedDlt = signal('');
  protected readonly dltMessages = signal<KafkaDltMessage[]>([]);
  protected readonly dltState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly selectedOffsets = signal<ReadonlySet<string>>(new Set());
  protected readonly messageDetail = signal<KafkaDltMessage | null>(null);

  protected readonly businessTopics = computed(() => this.topics().filter((t) => !isDlt(t.name)));
  protected readonly dltNames = computed(() =>
    this.topics()
      .filter((topic) => isDlt(topic.name))
      .map((topic) => topic.name),
  );
  protected readonly partitionTotal = computed(() =>
    this.businessTopics().reduce((sum, topic) => sum + topic.partitions, 0),
  );
  protected readonly degradedTopics = computed(() => {
    const health = this.health();
    return health
      ? Object.values(health).filter((h) => h === 'degraded' || h === 'offline').length
      : null;
  });
  protected readonly laggingGroups = computed(() => {
    const lags = this.lags();
    return lags
      ? Object.values(lags).filter((lag) => lag !== 'unknown' && lag.known > 0).length
      : null;
  });
  protected readonly detailsCapped = computed(
    () => this.topics().length > DETAIL_LIMIT || this.groups().length > DETAIL_LIMIT,
  );
  protected readonly allSelected = computed(
    () =>
      this.dltMessages().length > 0 &&
      this.dltMessages().every((message) => this.selectedOffsets().has(this.offsetKey(message))),
  );

  constructor() {
    this.load();
  }

  protected isDlt = isDlt;

  protected groupState(state: string): string {
    return GROUP_STATES[state.toUpperCase()] ?? state;
  }

  protected healthOf(name: string): TopicHealth | undefined {
    return this.health()?.[name];
  }

  protected lagOf(groupId: string): GroupLagState | undefined {
    return this.lags()?.[groupId];
  }

  protected selectView(view: KafkaView): void {
    this.view.set(view);
    if (view === 'dlt' && this.dltState() === 'idle') {
      this.selectDlt(this.selectedDlt() || this.dltNames()[0] || '');
    }
  }

  protected refresh(): void {
    if (this.loadState() !== 'loading') {
      this.load(true);
    }
  }

  protected openTopic(name: string): void {
    this.detailTitle.set(name);
    this.topicDetail.set(null);
    this.openDetail(this.topicTemplate(), this.kafka.getTopic(name), (detail) =>
      this.topicDetail.set(detail),
    );
  }

  protected openGroup(groupId: string): void {
    this.detailTitle.set(groupId);
    this.groupDetail.set(null);
    this.resetPreview.set(null);
    this.openDetail(this.groupTemplate(), this.kafka.getConsumerGroup(groupId), (detail) =>
      this.showGroup(detail),
    );
  }

  protected openMessage(message: KafkaDltMessage): void {
    this.messageDetail.set(message);
    this.dialog.open(this.messageTemplate(), this.dialogConfig());
  }

  protected selectResetTopic(topic: string): void {
    this.resetTopic.set(topic);
    this.resetPreview.set(null);
  }

  protected simulateReset(): void {
    this.runReset(true);
  }

  protected applyReset(): void {
    const detail = this.groupDetail();
    if (!detail) {
      return;
    }
    this.confirm({
      title: 'Reiniciar offsets',
      message: `Los offsets de «${detail.groupId}» en ${this.resetTopic()} vuelven al primer mensaje disponible. El grupo volverá a leer esos mensajes al conectarse.`,
      confirmLabel: 'Reiniciar',
      danger: true,
    }).subscribe((ok) => {
      if (ok) {
        this.runReset(false);
      }
    });
  }

  protected deleteTopic(topic: KafkaTopicSummary): void {
    this.confirm({
      title: 'Eliminar tópico',
      message: `Se eliminará el tópico «${topic.name}» con sus mensajes. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.busy.set(true);
      this.kafka
        .deleteTopic(topic.name)
        .pipe(
          map(() => true),
          catchError((error: unknown) => this.fail(error, false)),
          finalize(() => this.busy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((deleted) => {
          if (deleted) {
            this.snackBar.open(`Tópico «${topic.name}» eliminado.`, 'Cerrar', { duration: 4000 });
            this.load();
          }
        });
    });
  }

  protected selectDlt(name: string): void {
    this.selectedDlt.set(name);
    this.selectedOffsets.set(new Set());
    if (!name) {
      this.dltState.set('ready');
      this.dltMessages.set([]);
      return;
    }
    this.dltState.set('loading');
    this.kafka
      .listDltMessages(name, { limit: DLT_PAGE })
      .pipe(
        map((view) => flattenDltMessages(view)),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((messages) => {
        this.dltMessages.set(messages ?? []);
        this.dltState.set(messages ? 'ready' : 'error');
      });
  }

  protected isSelected(message: KafkaDltMessage): boolean {
    return this.selectedOffsets().has(this.offsetKey(message));
  }

  protected toggleMessage(message: KafkaDltMessage, checked: boolean): void {
    const next = new Set(this.selectedOffsets());
    if (checked) {
      next.add(this.offsetKey(message));
    } else {
      next.delete(this.offsetKey(message));
    }
    this.selectedOffsets.set(next);
  }

  protected toggleAll(checked: boolean): void {
    this.selectedOffsets.set(
      new Set(checked ? this.dltMessages().map((message) => this.offsetKey(message)) : []),
    );
  }

  protected replaySelected(): void {
    const dlt = this.selectedDlt();
    const selected = this.dltMessages().filter((message) => this.isSelected(message));
    if (!dlt || selected.length === 0) {
      return;
    }
    const count = selected.length === 1 ? '1 mensaje' : `${selected.length} mensajes`;
    this.confirm({
      title: 'Reenviar mensajes',
      message: `Se reenviarán ${count} de «${dlt}» a su tópico de origen. Los consumidores los procesarán otra vez.`,
      confirmLabel: 'Reenviar',
    }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.busy.set(true);
      this.kafka
        .replayDlt(dlt, {
          offsets: selected.map(({ partition, offset }) => ({ partition, offset })),
        })
        .pipe(
          catchError((error: unknown) => this.fail(error, null)),
          finalize(() => this.busy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => {
          if (!result) {
            return;
          }
          const parts = [`${result.resent} reenviados`];
          if (result.skipped) parts.push(`${result.skipped} omitidos`);
          if (result.failed) parts.push(`${result.failed} con error`);
          if (result.notAttempted) parts.push(`${result.notAttempted} sin intentar`);
          this.snackBar.open(`Reenvío: ${parts.join(', ')}.`, 'Cerrar', { duration: 6000 });
          this.selectDlt(dlt);
        });
    });
  }

  protected prettyJson(value: string | null): string {
    if (!value) {
      return 'Sin contenido';
    }
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  private load(manual = false): void {
    this.loadState.set('loading');
    this.isRefreshing.set(manual);
    forkJoin({
      topics: this.kafka.listTopics().pipe(
        catchError((error: unknown) => {
          this.failure.set(failureKind(error));
          return of(null);
        }),
      ),
      groups: this.kafka.listConsumerGroups().pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => this.isRefreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ topics, groups }) => {
        if (!topics) {
          this.loadState.set('error');
          return;
        }
        this.topics.set(topics);
        this.groups.set(groups ?? []);
        this.groupsFailed.set(groups === null);
        this.hasData.set(true);
        this.fetchedAt.set(new Date());
        this.loadState.set('ready');
        this.loadHealth(topics);
        this.loadLags(groups ?? []);
        if (this.view() === 'dlt' || this.dltState() !== 'idle') {
          const current = this.dltNames().includes(this.selectedDlt()) ? this.selectedDlt() : '';
          this.selectDlt(current || this.dltNames()[0] || '');
        }
      });
  }

  private loadHealth(topics: KafkaTopicSummary[]): void {
    this.health.set(null);
    const sample = topics.slice(0, DETAIL_LIMIT);
    if (sample.length === 0) {
      this.health.set({});
      return;
    }
    forkJoin(
      sample.map((topic) =>
        this.kafka.getTopic(topic.name).pipe(
          map((detail) => [topic.name, topicHealth(detail)] as const),
          catchError(() => of([topic.name, 'unknown'] as const)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => this.health.set(Object.fromEntries(entries)));
  }

  private loadLags(groups: KafkaGroupSummary[]): void {
    this.lags.set(null);
    const sample = groups.slice(0, DETAIL_LIMIT);
    if (sample.length === 0) {
      this.lags.set({});
      return;
    }
    forkJoin(
      sample.map((group) =>
        this.kafka.getConsumerGroup(group.groupId).pipe(
          map((detail) => [group.groupId, groupLag(detail)] as const),
          catchError(() => of([group.groupId, 'unknown'] as const)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entries) => this.lags.set(Object.fromEntries(entries)));
  }

  private openDetail<T>(
    template: TemplateRef<unknown>,
    source: Observable<T>,
    show: (detail: T) => void,
  ): void {
    this.detailFailed.set(false);
    this.detailLoading.set(true);
    this.dialog.open(template, this.dialogConfig());
    source
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
          show(detail);
        }
      });
  }

  private showGroup(detail: KafkaGroupDetail): void {
    this.groupDetail.set(detail);
    const topics = detail.topics.map((topic) => topic.topic);
    if (!topics.includes(this.resetTopic())) {
      this.resetTopic.set(topics[0] ?? '');
    }
  }

  private runReset(dryRun: boolean): void {
    const detail = this.groupDetail();
    const topic = this.resetTopic();
    if (!detail || !topic) {
      return;
    }
    this.busy.set(true);
    this.kafka
      .resetOffsets(detail.groupId, { topic, strategy: 'EARLIEST', dryRun })
      .pipe(
        catchError((error: unknown) => this.fail(error, null)),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if (dryRun) {
          this.resetPreview.set(result);
          return;
        }
        this.resetPreview.set(null);
        this.snackBar.open(`Offsets de «${detail.groupId}» reiniciados en ${topic}.`, 'Cerrar', {
          duration: 5000,
        });
        this.kafka
          .getConsumerGroup(detail.groupId)
          .pipe(
            catchError(() => of(null)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe((updated) => {
            if (updated) {
              this.showGroup(updated);
              this.lags.update((lags) =>
                lags ? { ...lags, [updated.groupId]: groupLag(updated) } : lags,
              );
            }
          });
      });
  }

  private dialogConfig() {
    return {
      panelClass: 'admin-dialog',
      width: '48rem',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-heading',
    };
  }

  private offsetKey(message: KafkaDltMessage): string {
    return `${message.partition}:${message.offset}`;
  }

  private confirm(data: ConfirmActionDialogData) {
    return this.dialog
      .open<ConfirmActionDialogComponent, ConfirmActionDialogData, boolean>(
        ConfirmActionDialogComponent,
        { data, width: '28rem', maxWidth: 'calc(100vw - 32px)', panelClass: 'admin-dialog' },
      )
      .afterClosed();
  }

  /** El 409 de kafka-admin trae el motivo exacto (miembros activos, grupo del sistema). */
  private fail<T>(error: unknown, fallback: T): Observable<T> {
    this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 6000 });
    return of(fallback);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      const message: unknown = error.error?.message;
      if (typeof message === 'string' && message) {
        return message;
      }
    }
    switch (failureKind(error)) {
      case 'unavailable':
        return 'El servicio de Kafka no responde. Inténtalo en unos minutos.';
      case 'forbidden':
        return 'No tienes permiso para administrar Kafka.';
      default:
        return 'No pudimos completar la operación sobre Kafka.';
    }
  }
}
