import { chileDateKey, chileDateTime, isDateKey } from '../audit/audit-time';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY_MS = 86_400_000;

/** Días de calendario entre dos fechas civiles YYYY-MM-DD, en UTC para que un cambio de horario no corra el día. */
function daysBetween(from: string, to: string): number {
  const utc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

function civilDay(key: string, todayKey: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const label = `${day} ${MONTHS[month - 1]}`;
  return key.slice(0, 4) === todayKey.slice(0, 4) ? label : `${label} ${year}`;
}

/**
 * Vencimiento según `dueDate`, que report entrega como fecha civil de Chile. Se cuenta en días de calendario:
 * los hábiles dependen de los feriados, que solo conoce report.
 */
export function dueDateLabel(dueDate: string | null, now: Date = new Date()): string {
  if (!isDateKey(dueDate)) {
    return '';
  }
  const today = chileDateKey(now);
  const days = daysBetween(today, dueDate);
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days === -1) return 'Venció ayer';
  return days < 0
    ? `Venció el ${civilDay(dueDate, today)}`
    : `Vence el ${civilDay(dueDate, today)}`;
}

/** Hora de un evento de auditoría en Chile; la fecha solo cuando no es de hoy. */
export function eventMoment(occurredAt: string, now: Date = new Date()): string {
  const parts = chileDateTime(occurredAt);
  if (!parts) {
    return '';
  }
  const time = parts.time.slice(0, 5);
  return chileDateKey(new Date(occurredAt)) === chileDateKey(now) ? time : `${parts.date} ${time}`;
}
