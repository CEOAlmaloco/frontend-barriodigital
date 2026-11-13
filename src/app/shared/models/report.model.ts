import { RequestStatus } from './request.model';

/** Ventanas fijas de report (EP3-07, sección 3.3). */
export type ReportRange = 'last24h' | 'last7d';

export const REPORT_RANGES: readonly ReportRange[] = ['last24h', 'last7d'];
export const DEFAULT_REPORT_RANGE: ReportRange = 'last24h';

export function isReportRange(value: unknown): value is ReportRange {
  return typeof value === 'string' && REPORT_RANGES.includes(value as ReportRange);
}

export type OpenRequestStatus = Extract<
  RequestStatus,
  'INGRESADO' | 'ADMITIDO' | 'EN_GESTION' | 'EN_TERRENO'
>;

export const OPEN_REQUEST_STATUSES: readonly OpenRequestStatus[] = [
  'INGRESADO',
  'ADMITIDO',
  'EN_GESTION',
  'EN_TERRENO',
];

export interface ReportPoint {
  /** Inicio del tramo, instante UTC. */
  bucketStart: string;
  count: number;
}

export interface ReportSeries {
  bucket: 'HOUR' | 'DAY';
  /** Todos los tramos de la ventana, también los vacíos; el último va incompleto. */
  points: ReportPoint[];
}

/** `GET /api/report/kpis` (EP3-07, sección 3.4). */
export interface ReportKpis {
  range: ReportRange;
  requestsOverTime: ReportSeries;
  /** Foto del momento: no depende de `range`. */
  activeByStatus: Partial<Record<OpenRequestStatus, number>>;
  averageResolutionHours: number | null;
  resolvedCount: number;
  /** `rate` es null cuando no hubo cierres con plazo evaluable (`onTime + late = 0`). */
  slaCompliance: { rate: number | null; onTime: number; late: number };
  lastEventAt: string | null;
}

export interface TopProcedure {
  procedureType: string;
  procedureLabel: string | null;
  count: number;
}

/** `GET /api/report/top-procedures` (EP3-07, sección 3.5). */
export interface ReportTopProcedures {
  range: ReportRange;
  items: TopProcedure[];
  lastEventAt: string | null;
}
