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
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';

import { KafkaAdminService } from '../../../core/kafka/kafka-admin.service';
import {
  flattenDltMessages,
  totalLag,
  type KafkaDltMessage,
  type KafkaGroupDetail,
  type KafkaGroupSummary,
  type KafkaTopicDetail,
  type KafkaTopicSummary,
} from '../../../core/kafka/kafka-admin.models';
import { failureKind } from '../../../shared/utils/http-failure';
import { formatClock } from '../../reports/report-format';
import {
  RankingItem,
  ReportRankingComponent,
} from '../../reports/report-ranking/report-ranking.component';
import {
  ConfirmActionDialogComponent,
  type ConfirmActionDialogData,
} from '../confirm-action-dialog/confirm-action-dialog.component';

type KafkaSection = 'topics' | 'groups' | 'dlt';
type TopicHealth = 'ok' | 'degraded' | 'offline';

/** Tope de grupos/tópicos a los que se pide detalle (evita N+1 masivo). */
const LAG_SAMPLE = 8;

@Component({
  selector: 'app-admin-kafka-panel',
  imports: [
    MatButton,
    MatCheckbox,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatLabel,
    MatOption,
    MatProgressSpinner,
    MatSelect,
    MatTableModule,
    MatTooltip,
    ReportRankingComponent,
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

  protected readonly section = signal<KafkaSection>('topics');
  protected readonly topics = signal<KafkaTopicSummary[]>([]);
  protected readonly groups = signal<KafkaGroupSummary[]>([]);
  protected readonly groupDetail = signal<KafkaGroupDetail | null>(null);
  protected readonly topicDetail = signal<KafkaTopicDetail | null>(null);
  protected readonly dltMessageDetail = signal<KafkaDltMessage | null>(null);
  protected readonly dltNames = signal<string[]>([]);
  protected readonly selectedDlt = signal<string>('');
  protected readonly dltMessages = signal<KafkaDltMessage[]>([]);
  protected readonly selectedOffsets = signal<Set<string>>(new Set());
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly detailLoading = signal(false);
  protected readonly busy = signal(false);
  protected readonly fetchedAt = signal<Date | null>(null);
  protected readonly lagRanking = signal<RankingItem[]>([]);
  protected readonly groupLag = signal<Record<string, number>>({});
  protected readonly topicHealth = signal<Record<string, TopicHealth>>({});
  protected readonly partitionHealth = signal<{
    sampled: number;
    online: number;
    underReplicated: number;
    offlineLeaders: number;
  } | null>(null);
  protected readonly formatClock = formatClock;

  protected readonly topicColumns = [
    'name',
    'health',
    'partitions',
    'replication',
    'system',
    'acciones',
  ] as const;
  protected readonly groupColumns = [
    'groupId',
    'state',
    'members',
    'lag',
    'system',
    'acciones',
  ] as const;
  protected readonly dltColumns = [
    'select',
    'event',
    'partition',
    'offset',
    'error',
    'receivedAt',
    'acciones',
  ] as const;

  protected readonly selectedGroupLag = computed(() => {
    const detail = this.groupDetail();
    return detail ? totalLag(detail) : null;
  });
  /** Tópicos visibles en tabla excluyendo DLT (incluye sistema). */
  protected readonly topicCount = computed(
    () => this.topics().filter((topic) => !topic.name.endsWith('.DLT')).length,
  );
  protected readonly partitionTotal = computed(() =>
    this.topics()
      .filter((topic) => !topic.name.endsWith('.DLT'))
      .reduce((sum, topic) => sum + topic.partitions, 0),
  );
  protected readonly groupsWithMembers = computed(
    () => this.groups().filter((group) => group.members > 0).length,
  );
  protected readonly emptyGroups = computed(
    () => this.groups().filter((group) => group.state === 'Empty' || group.members === 0).length,
  );
  protected readonly underReplicatedSample = computed(() => {
    const detail = this.topicDetail();
    if (!detail) {
      return null;
    }
    return detail.partitions.filter((part) => part.isr.length < part.replicas.length).length;
  });
  protected readonly lagTotal = computed(() =>
    Object.values(this.groupLag()).reduce((sum, value) => sum + value, 0),
  );
  protected readonly partitionHealthItems = computed<RankingItem[]>(() => {
    const health = this.partitionHealth();
    if (!health || health.sampled === 0) {
      return [];
    }
    return [
      { label: 'Online', value: health.online },
      { label: 'Under-replicated', value: health.underReplicated },
      { label: 'Sin líder', value: health.offlineLeaders },
    ].filter((item) => item.value > 0 || item.label === 'Online');
  });

  constructor() {
    this.reload();
  }

  protected selectSection(section: KafkaSection): void {
    this.section.set(section);
    if (section === 'dlt' && this.dltNames().length > 0 && this.dltMessages().length === 0) {
      this.prepareDlt();
    }
  }

  protected reload(): void {
    this.loadState.set('loading');
    this.lagRanking.set([]);
    this.groupLag.set({});
    this.topicHealth.set({});
    this.partitionHealth.set(null);
    forkJoin({
      topics: this.kafka.listTopics().pipe(catchError(() => of(null))),
      groups: this.kafka.listConsumerGroups().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ topics, groups }) => {
        if (!topics) {
          this.snackBar.open('No pudimos cargar Kafka.', 'Cerrar', { duration: 5000 });
          this.loadState.set('error');
          return;
        }
        this.topics.set(topics);
        this.dltNames.set(topics.filter((topic) => topic.name.endsWith('.DLT')).map((t) => t.name));
        if (groups) {
          this.groups.set(groups);
          this.loadLagSample(groups);
        }
        this.loadPartitionHealth(topics);
        this.fetchedAt.set(new Date());
        this.loadState.set('ready');
        if (this.section() === 'dlt') {
          this.prepareDlt();
        }
      });
  }

  protected healthOf(name: string): TopicHealth | null {
    return this.topicHealth()[name] ?? null;
  }

  protected lagOf(groupId: string): number | null {
    const lag = this.groupLag()[groupId];
    return lag === undefined ? null : lag;
  }

  /** Lag por grupo (muestra). Incluye 0 para no ocultar grupos sanos. */
  private loadLagSample(groups: KafkaGroupSummary[]): void {
    const preferred = groups.filter((group) => !group.system);
    const sample = (preferred.length > 0 ? preferred : groups).slice(0, LAG_SAMPLE);
    if (sample.length === 0) {
      return;
    }
    forkJoin(
      sample.map((group) =>
        this.kafka.getConsumerGroup(group.groupId).pipe(catchError(() => of(null))),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((details) => {
        const lagMap: Record<string, number> = {};
        const ranking: RankingItem[] = [];
        for (const detail of details) {
          if (!detail) {
            continue;
          }
          const value = totalLag(detail);
          lagMap[detail.groupId] = value;
          ranking.push({ label: detail.groupId, value });
        }
        ranking.sort((a, b) => b.value - a.value);
        this.groupLag.set(lagMap);
        this.lagRanking.set(ranking);
      });
  }

  /** Salud de particiones + mapa por tópico (muestra no-DLT, incluye sistema). */
  private loadPartitionHealth(topics: KafkaTopicSummary[]): void {
    const sample = topics.filter((topic) => !topic.name.endsWith('.DLT')).slice(0, LAG_SAMPLE);
    if (sample.length === 0) {
      this.partitionHealth.set({
        sampled: 0,
        online: 0,
        underReplicated: 0,
        offlineLeaders: 0,
      });
      return;
    }
    forkJoin(
      sample.map((topic) => this.kafka.getTopic(topic.name).pipe(catchError(() => of(null)))),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((details) => {
        let online = 0;
        let underReplicated = 0;
        let offlineLeaders = 0;
        let sampled = 0;
        const healthMap: Record<string, TopicHealth> = {};
        for (const detail of details) {
          if (!detail) {
            continue;
          }
          sampled += 1;
          let topicStatus: TopicHealth = 'ok';
          for (const part of detail.partitions) {
            if (part.leader == null || part.leader < 0) {
              offlineLeaders += 1;
              topicStatus = 'offline';
            } else {
              online += 1;
            }
            if (part.isr.length < part.replicas.length) {
              underReplicated += 1;
              if (topicStatus === 'ok') {
                topicStatus = 'degraded';
              }
            }
          }
          healthMap[detail.name] = topicStatus;
        }
        this.topicHealth.set(healthMap);
        this.partitionHealth.set({ sampled, online, underReplicated, offlineLeaders });
      });
  }

  protected openTopic(name: string): void {
    this.section.set('topics');
    this.detailLoading.set(true);
    this.topicDetail.set(null);
    this.groupDetail.set(null);
    this.dltMessageDetail.set(null);
    this.kafka
      .getTopic(name)
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => this.topicDetail.set(detail));
  }

  protected openGroup(groupId: string): void {
    this.section.set('groups');
    this.detailLoading.set(true);
    this.groupDetail.set(null);
    this.topicDetail.set(null);
    this.dltMessageDetail.set(null);
    this.kafka
      .getConsumerGroup(groupId)
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => this.groupDetail.set(detail));
  }

  protected openDltMessage(message: KafkaDltMessage): void {
    this.dltMessageDetail.set(message);
  }

  protected closeDetails(): void {
    this.topicDetail.set(null);
    this.groupDetail.set(null);
    this.dltMessageDetail.set(null);
  }

  protected prettyJson(value: string | null): string {
    if (!value) {
      return '—';
    }
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  protected deleteTopic(topic: KafkaTopicSummary): void {
    if (topic.system) {
      this.snackBar.open('Los tópicos del sistema no se pueden eliminar.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }
    this.confirm({
      title: 'Eliminar tópico',
      message: `Se borrará el tópico «${topic.name}». Solo continúa si no tiene consumidores activos.`,
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
          catchError((error: unknown) => {
            this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
            return of(false);
          }),
          finalize(() => this.busy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((okResult) => {
          if (okResult) {
            this.snackBar.open(`Tópico «${topic.name}» eliminado.`, 'Cerrar', { duration: 4000 });
            this.reload();
          }
        });
    });
  }

  protected resetOffsets(dryRun: boolean): void {
    const detail = this.groupDetail();
    const topic = detail?.topics[0]?.topic;
    if (!detail || !topic) {
      this.snackBar.open('Abre un grupo con tópicos para resetear offsets.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }
    const run = () => {
      this.busy.set(true);
      this.kafka
        .resetOffsets(detail.groupId, { topic, strategy: 'EARLIEST', dryRun })
        .pipe(
          catchError((error: unknown) => {
            this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
            return of(null);
          }),
          finalize(() => this.busy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => {
          if (result === null) {
            return;
          }
          this.snackBar.open(
            dryRun
              ? `Simulación OK en «${detail.groupId}» / ${topic}.`
              : `Offsets reiniciados en «${detail.groupId}» / ${topic}.`,
            'Cerrar',
            { duration: 5000 },
          );
          if (!dryRun) {
            this.openGroup(detail.groupId);
          }
        });
    };

    if (dryRun) {
      run();
      return;
    }
    this.confirm({
      title: 'Reiniciar offsets',
      message: `Se moverán los offsets de «${detail.groupId}» en ${topic} a EARLIEST. Detén el consumidor antes en mantenimiento.`,
      confirmLabel: 'Reiniciar',
      danger: true,
    }).subscribe((ok) => {
      if (ok) {
        run();
      }
    });
  }

  protected onDltChange(name: string): void {
    this.selectedDlt.set(name);
    this.selectedOffsets.set(new Set());
    this.loadDltMessages(name);
  }

  protected toggleMessage(message: KafkaDltMessage, checked: boolean): void {
    const key = this.offsetKey(message);
    const next = new Set(this.selectedOffsets());
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedOffsets.set(next);
  }

  protected isSelected(message: KafkaDltMessage): boolean {
    return this.selectedOffsets().has(this.offsetKey(message));
  }

  protected replaySelected(): void {
    const dlt = this.selectedDlt();
    const selected = this.dltMessages().filter((message) => this.isSelected(message));
    if (!dlt || selected.length === 0) {
      this.snackBar.open('Selecciona al menos un mensaje de la DLT.', 'Cerrar', { duration: 4000 });
      return;
    }
    this.confirm({
      title: 'Reenviar desde DLT',
      message: `Se reenviarán ${selected.length} mensaje(s) de «${dlt}» al tópico original.`,
      confirmLabel: 'Reenviar',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.busy.set(true);
      this.kafka
        .replayDlt(dlt, {
          offsets: selected.map((message) => ({
            partition: message.partition,
            offset: message.offset,
          })),
        })
        .pipe(
          catchError((error: unknown) => {
            this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
            return of(null);
          }),
          finalize(() => this.busy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => {
          if (!result) {
            return;
          }
          this.snackBar.open(
            `Replay: ${result.resent} reenviado(s), ${result.failed} fallido(s), ${result.skipped} omitido(s).`,
            'Cerrar',
            { duration: 6000 },
          );
          this.selectedOffsets.set(new Set());
          this.loadDltMessages(dlt);
        });
    });
  }

  private prepareDlt(): void {
    const names = this.dltNames();
    if (names.length === 0) {
      return;
    }
    if (!this.selectedDlt()) {
      this.selectedDlt.set(names[0]);
    }
    this.loadDltMessages(this.selectedDlt());
  }

  private loadDltMessages(name: string): void {
    if (!name) {
      return;
    }
    this.detailLoading.set(true);
    this.kafka
      .listDltMessages(name, { limit: 50 })
      .pipe(
        catchError((error: unknown) => {
          this.snackBar.open(this.errorMessage(error), 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((view) => {
        this.dltMessages.set(view ? flattenDltMessages(view) : []);
      });
  }

  private offsetKey(message: KafkaDltMessage): string {
    return `${message.partition}:${message.offset}`;
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
        return 'El servicio de Kafka no responde. Inténtalo en unos minutos.';
      case 'forbidden':
        return 'No tienes permiso para administrar Kafka.';
      default:
        return 'No pudimos completar la operación sobre Kafka.';
    }
  }
}
