import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { MqAdminService } from '../../../core/mq/mq-admin.service';
import { isLikelyDlq } from '../../../core/mq/mq-admin.models';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import { blockView, readyData } from '../home-block-view';

const NAMES_SHOWN = 3;

/** «Bache en calle», «Bache en calle y Alumbrado público» o «A, B, C y 2 más». */
function namesLabel(names: string[]): string {
  const shown = names.slice(0, NAMES_SHOWN);
  const rest = names.length - shown.length;
  if (rest > 0) {
    return `${shown.join(', ')} y ${rest} más`;
  }
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}` : shown[0];
}

/**
 * Excepciones que el Admin resuelve desde Administración. Cada fuente carga y falla por separado; el bloque
 * no aparece mientras carga ni cuando no hay nada que atender.
 */
@Component({
  selector: 'app-home-attention',
  imports: [MatButton, MatIcon, RouterLink],
  templateUrl: './home-attention.component.html',
  styleUrls: ['./home-attention.component.scss', '../home-link.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAttentionComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly mq = inject(MqAdminService);

  protected readonly catalog = loadedResource({
    key: 0,
    load: () => this.catalogService.getProcedures(),
  });
  protected readonly queues = loadedResource({ key: 0, load: () => this.mq.listQueues() });

  private readonly catalogView = computed(() => blockView(this.catalog.state(), 0));
  private readonly queuesView = computed(() => blockView(this.queues.state(), 0));

  protected readonly catalogFailed = computed(() => this.catalogView().status === 'error');
  protected readonly queuesFailed = computed(() => this.queuesView().status === 'error');

  /** Solo los tipos activos: uno inactivo no recibe trámites aunque no tenga cupo. */
  protected readonly exhausted = computed(() =>
    (readyData(this.catalogView()) ?? [])
      .filter(
        (type) => type.active && typeof type.dailyQuota === 'number' && type.remainingQuota === 0,
      )
      .map((type) => type.label),
  );
  protected readonly dlq = computed(() => {
    const dlqs = (readyData(this.queuesView()) ?? []).filter(
      (queue) => isLikelyDlq(queue) && queue.messages > 0,
    );
    return { queues: dlqs.length, messages: dlqs.reduce((sum, queue) => sum + queue.messages, 0) };
  });

  protected readonly visible = computed(
    () =>
      this.exhausted().length > 0 ||
      this.dlq().messages > 0 ||
      this.catalogFailed() ||
      this.queuesFailed(),
  );

  protected readonly quotaText = computed(() => {
    const names = this.exhausted();
    return names.length === 1
      ? `${names[0]} agotó su cupo diario.`
      : `${names.length} tipos agotaron su cupo diario: ${namesLabel(names)}.`;
  });
  protected readonly dlqText = computed(() => {
    const { queues, messages } = this.dlq();
    const count = messages === 1 ? '1 mensaje sin procesar' : `${messages} mensajes sin procesar`;
    return `${count} en ${queues === 1 ? 'una DLQ' : `${queues} DLQ`} de RabbitMQ.`;
  });

  constructor() {
    this.catalog.setKey(0);
    this.queues.setKey(0);
  }

  protected isRetrying(source: 'catalog' | 'queues'): boolean {
    const view = source === 'catalog' ? this.catalogView() : this.queuesView();
    return view.status === 'error' && view.retrying;
  }

  protected retry(source: 'catalog' | 'queues'): void {
    if (!this.isRetrying(source)) {
      (source === 'catalog' ? this.catalog : this.queues).refresh();
    }
  }
}
