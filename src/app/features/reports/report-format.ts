import { HttpErrorResponse } from '@angular/common/http';

import { ReportRange, ReportSeries } from '../../shared/models/report.model';

/** Los tramos de report se cortan en hora de Chile (EP3-07, sección 3.3). */
const ZONE = 'America/Santiago';

const countFormat = new Intl.NumberFormat('es-CL');
const percentFormat = new Intl.NumberFormat('es-CL', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const clockFormat = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const bucketFormat = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'shortOffset',
});

export const RANGE_LABELS: Readonly<Record<ReportRange, string>> = {
  last24h: 'Últimas 24 horas',
  last7d: 'Últimos 7 días',
};

/** Período dentro de una frase: «en las últimas 24 horas». */
export const RANGE_PHRASES: Readonly<Record<ReportRange, string>> = {
  last24h: 'las últimas 24 horas',
  last7d: 'los últimos 7 días',
};

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatPercent(rate: number): string {
  return percentFormat.format(rate);
}

/** Hora local con segundos, para la última consulta. */
export function formatClock(date: Date): string {
  return clockFormat.format(date);
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

export interface BucketLabel {
  /** Etiqueta corta del eje: «14:00» o «vie 13». */
  axis: string;
  /** Etiqueta completa para la tabla y el resumen. */
  full: string;
}

/**
 * Etiquetas de los tramos en hora de Chile. Al volver al horario de invierno una hora local se repite: esas
 * filas llevan el desplazamiento UTC, porque la fecha y la hora solas no distinguen los dos tramos.
 */
export function bucketLabels(series: ReportSeries): BucketLabel[] {
  const parts = series.points.map((point) => {
    const values = Object.fromEntries(
      bucketFormat
        .formatToParts(new Date(point.bucketStart))
        .map(({ type, value }) => [type, value.replace('.', '')]),
    );
    return {
      weekday: values['weekday'],
      date: `${values['day']} ${values['month']}`,
      day: values['day'],
      time: `${values['hour']}:${values['minute']}`,
      offset: (values['timeZoneName'] ?? '').replace('GMT', 'UTC').replace('-', '−'),
    };
  });

  if (series.bucket === 'DAY') {
    return parts.map((p) => ({ axis: `${p.weekday} ${p.day}`, full: `${p.weekday} ${p.date}` }));
  }

  const plain = parts.map((p) => `${p.date}, ${p.time}`);
  return parts.map((p, index) => {
    const repeated = plain.indexOf(plain[index]) !== plain.lastIndexOf(plain[index]);
    return { axis: p.time, full: repeated ? `${plain[index]} (${p.offset})` : plain[index] };
  });
}

export type FailureKind = 'unavailable' | 'forbidden' | 'generic';

/** 503 lo responde el BFF cuando report no contesta (EP3-44); 403, cuando el rol no alcanza. */
export function failureKind(error: unknown): FailureKind {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 503) return 'unavailable';
    if (error.status === 403) return 'forbidden';
  }
  return 'generic';
}
