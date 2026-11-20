import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { KafkaAdminService } from '../../../core/kafka/kafka-admin.service';
import { KafkaTopicSummary } from '../../../core/kafka/kafka-admin.models';
import { MqAdminService } from '../../../core/mq/mq-admin.service';
import { MqQueue, isLikelyDlq } from '../../../core/mq/mq-admin.models';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import { formatCount } from '../../reports/report-format';
import { blockView, readyData } from '../home-block-view';
import { HomeStateComponent } from '../home-state/home-state.component';

interface PlatformSnapshot {
  queues: MqQueue[] | null;
  topics: KafkaTopicSummary[] | null;
}

type HealthTone = 'ok' | 'warn' | 'error' | 'unknown';

interface PlatformTile {
  label: string;
  value: string;
  meta: string;
  tone: HealthTone;
  link: string;
  fragment: string | null;
}

/** Estado técnico con datos reales de mq-admin y kafka-admin. Sin métricas inventadas. */
@Component({
  selector: 'app-home-platform-strip',
  imports: [HomeStateComponent, MatIcon, RouterLink],
  template: `
    <section class="platform" aria-labelledby="home-platform-title">
      <div class="platform__bar">
        <div>
          <h2 id="home-platform-title">Estado de la plataforma</h2>
          <p class="platform__subtitle">
            Solo señales verificables de RabbitMQ y Kafka. No incluye CPU, memoria ni latencia.
          </p>
        </div>
        <button
          type="button"
          class="platform__refresh"
          [attr.aria-disabled]="source.state().loading"
          (click)="source.state().loading || source.refresh()"
        >
          <mat-icon aria-hidden="true">refresh</mat-icon>
          Actualizar
        </button>
      </div>

      @switch (view().status) {
        @case ('loading') {
          <p class="platform__muted">Consultando administración de mensajería…</p>
        }
        @case ('error') {
          <app-home-state
            icon="cloud_off"
            tone="error"
            heading="No se pudo consultar el estado técnico"
            message="Revisa Administración o vuelve a intentar."
          />
        }
        @case ('ready') {
          <ul class="platform__tiles">
            @for (tile of tiles(); track tile.label) {
              <li [class]="'platform__tile platform__tile--' + tile.tone">
                <p class="platform__label">{{ tile.label }}</p>
                <p class="platform__value">{{ tile.value }}</p>
                <p class="platform__meta">{{ tile.meta }}</p>
                <a class="platform__link" [routerLink]="tile.link">Abrir sección</a>
              </li>
            }
          </ul>
          @if (partial()) {
            <p class="platform__notice">
              Algunos datos no respondieron. Se muestra solo lo que sí se pudo consultar.
            </p>
          }
        }
      }
    </section>
  `,
  styleUrl: './home-platform-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePlatformStripComponent implements OnInit {
  private readonly mq = inject(MqAdminService);
  private readonly kafka = inject(KafkaAdminService);

  protected readonly formatCount = formatCount;
  protected readonly source = loadedResource<number, PlatformSnapshot>({
    key: 0,
    load: () =>
      forkJoin({
        queues: this.mq.listQueues().pipe(catchError(() => of(null))),
        topics: this.kafka.listTopics().pipe(catchError(() => of(null))),
      }).pipe(map((snapshot) => snapshot)),
  });
  protected readonly view = computed(() => blockView(this.source.state(), this.source.key()));
  protected readonly data = computed(() => readyData(this.view()));
  protected readonly partial = computed(() => {
    const data = this.data();
    return !!data && (data.queues === null || data.topics === null);
  });
  protected readonly tiles = computed<PlatformTile[]>(() => {
    const data = this.data();
    if (!data) {
      return [];
    }
    const tiles: PlatformTile[] = [];
    if (data.queues) {
      const dlq = data.queues.filter(isLikelyDlq);
      const dlqMessages = dlq.reduce((sum, queue) => sum + queue.messages, 0);
      const idle = data.queues.filter((queue) => queue.consumers === 0 && queue.messages > 0).length;
      tiles.push({
        label: 'RabbitMQ',
        value: dlqMessages > 0 ? formatCount(dlqMessages) : 'Operativo',
        meta:
          dlqMessages > 0
            ? `${formatCount(dlq.length)} DLQ con mensajes`
            : idle > 0
              ? `${formatCount(idle)} colas con mensajes sin consumidores`
              : `${formatCount(data.queues.length)} colas consultadas`,
        tone: dlqMessages > 0 ? 'error' : idle > 0 ? 'warn' : 'ok',
        link: '/admin',
        fragment: null,
      });
    } else {
      tiles.push({
        label: 'RabbitMQ',
        value: 'Sin información',
        meta: 'mq-admin no respondió',
        tone: 'unknown',
        link: '/admin',
        fragment: null,
      });
    }
    if (data.topics) {
      const dlt = data.topics.filter((topic) => topic.name.endsWith('.DLT'));
      tiles.push({
        label: 'Kafka',
        value: dlt.length > 0 ? formatCount(dlt.length) : 'Operativo',
        meta:
          dlt.length > 0
            ? 'Tópicos DLT presentes (revisar en Administración)'
            : `${formatCount(data.topics.length)} tópicos consultados`,
        tone: dlt.length > 0 ? 'warn' : 'ok',
        link: '/admin',
        fragment: null,
      });
    } else {
      tiles.push({
        label: 'Kafka',
        value: 'Sin información',
        meta: 'kafka-admin no respondió',
        tone: 'unknown',
        link: '/admin',
        fragment: null,
      });
    }
    return tiles;
  });

  ngOnInit(): void {
    this.source.setKey(0);
  }
}
