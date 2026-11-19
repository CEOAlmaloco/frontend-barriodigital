import { SlaStatus } from '../../shared/models/report.model';
import { chileDateKey, isDateKey } from '../audit/audit-time';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY_MS = 86_400_000;

/** Estados de un trámite abierto: solo en ellos el vencimiento es un aviso. */
const OPEN_SLA: readonly SlaStatus[] = ['DENTRO_DE_PLAZO', 'POR_VENCER', 'VENCIDO'];
/** Cerrados con plazo evaluado: la fecha queda como referencia de lo comprometido. */
const EVALUATED_SLA: readonly SlaStatus[] = ['CUMPLIDO', 'FUERA_DE_PLAZO'];

export type SlaDueTone = 'late' | 'soon' | 'neutral';

export interface SlaDue {
  text: string;
  tone: SlaDueTone;
}

/** «1 día hábil», «10 días hábiles». */
export function businessDaysLabel(days: number): string {
  return days === 1 ? '1 día hábil' : `${days} días hábiles`;
}

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

/**
 * Texto de la fecha que acompaña al estado del plazo. En un abierto, cuándo vence; en uno cerrado y evaluado, la
 * fecha comprometida; sin plazo o sin evaluación (No aplica), nada.
 */
export function slaDue(
  status: SlaStatus | null,
  dueDate: string | null,
  now = new Date(),
): SlaDue | null {
  if (!status || !isDateKey(dueDate)) {
    return null;
  }
  if (OPEN_SLA.includes(status)) {
    const tone = status === 'VENCIDO' ? 'late' : status === 'POR_VENCER' ? 'soon' : 'neutral';
    return { text: dueDateLabel(dueDate, now), tone };
  }
  if (EVALUATED_SLA.includes(status)) {
    return { text: `Plazo al ${civilDay(dueDate, chileDateKey(now))}`, tone: 'neutral' };
  }
  return null;
}
