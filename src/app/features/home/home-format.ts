import { chileDateKey, chileDateTime } from '../audit/audit-time';

/** Hora de un evento de auditoría en Chile; la fecha solo cuando no es de hoy. */
export function eventMoment(occurredAt: string, now: Date = new Date()): string {
  const parts = chileDateTime(occurredAt);
  if (!parts) {
    return '';
  }
  const time = parts.time.slice(0, 5);
  return chileDateKey(new Date(occurredAt)) === chileDateKey(now) ? time : `${parts.date} ${time}`;
}
