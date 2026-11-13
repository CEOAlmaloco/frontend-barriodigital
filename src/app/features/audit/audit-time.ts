/**
 * La auditoría se lee en hora de Chile, sin depender de la zona del navegador: el mismo evento debe mostrar la
 * misma hora a todo el que lo revise.
 */
const ZONE = 'America/Santiago';
const DAY_MS = 86_400_000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: number): ZonedParts {
  const values = Object.fromEntries(
    partsFormat.formatToParts(new Date(instant)).map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: values['year'],
    month: values['month'],
    day: values['day'],
    hour: values['hour'],
    minute: values['minute'],
    second: values['second'],
  };
}

const pad = (value: number) => String(value).padStart(2, '0');
const keyOf = (p: Pick<ZonedParts, 'year' | 'month' | 'day'>) =>
  `${p.year}-${pad(p.month)}-${pad(p.day)}`;

function zoneOffset(instant: number): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function isDateKey(value: string | null | undefined): value is string {
  const match = value ? DATE_KEY_PATTERN.exec(value) : null;
  if (!match) {
    return false;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    keyOf({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    }) === value
  );
}

export function chileDateKey(instant: Date): string {
  return keyOf(zonedParts(instant.getTime()));
}

/** Aritmética de calendario en UTC, para que un cambio de horario no corra el día. */
export function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return keyOf({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/**
 * Primer instante del día en Chile. Cuando empieza el horario de verano la medianoche no existe y el día
 * parte a la 01:00, por eso se elige el candidato más temprano que cae en ese día.
 */
export function chileDayStart(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const base = Date.UTC(year, month - 1, day);
  const first = base - zoneOffset(base);
  const second = base - zoneOffset(first);
  const candidates = [first, second]
    .filter((instant) => chileDateKey(new Date(instant)) === key)
    .sort((a, b) => a - b);
  return new Date(candidates[0] ?? first);
}

/** Último milisegundo del día en Chile, para un `to` inclusivo. */
export function chileDayEnd(key: string): Date {
  return new Date(chileDayStart(shiftDateKey(key, 1)).getTime() - 1);
}

/** Fecha y hora en Chile: «13/11/2026» y «16:42:08». */
export function chileDateTime(value: string): { date: string; time: string } | null {
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) {
    return null;
  }
  const p = zonedParts(instant);
  return {
    date: `${pad(p.day)}/${pad(p.month)}/${p.year}`,
    time: `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
  };
}
