/** Cola expuesta por mq-admin vía BFF (`GET /api/mq/queues`). */
export interface MqQueue {
  name: string;
  messages: number;
  /** Listos (Ready) según RabbitMQ Management. */
  messagesReady: number;
  /** Entregados sin ACK (Unacked). */
  messagesUnacked: number;
  consumers: number;
  durable: boolean;
  ttl: number | null;
  deadLetterExchange: string | null;
  deadLetterRoutingKey: string | null;
  /** p. ej. running / idle. */
  state?: string | null;
  memoryBytes?: number | null;
  publishRate?: number | null;
  deliverRate?: number | null;
  ackRate?: number | null;
}

/** Heurística de UI: colas de dead-letter por nombre o ruteo. */
export function isLikelyDlq(queue: MqQueue): boolean {
  const name = queue.name.toLowerCase();
  return name.includes('dead') || name.includes('dlq') || name.endsWith('.dlx');
}

export function formatRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) {
    return '—';
  }
  return `${rate.toLocaleString('es-CL', { maximumFractionDigits: 2 })} msg/s`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 })} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MiB`;
}
