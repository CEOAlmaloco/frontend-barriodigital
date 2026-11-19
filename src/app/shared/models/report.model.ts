import { Page } from './page.model';
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

/** `slaStatus` de report (EP3-06, sección 4.1). */
export type SlaStatus =
  | 'DENTRO_DE_PLAZO'
  | 'POR_VENCER'
  | 'VENCIDO'
  | 'CUMPLIDO'
  | 'FUERA_DE_PLAZO'
  | 'NO_APLICA'
  | 'SIN_PLAZO';

/** Los únicos estados que acepta el listado de plazos: los demás no son alertas. */
export type SlaAlertStatus = Extract<SlaStatus, 'VENCIDO' | 'POR_VENCER'>;

/** Ítem de `GET /api/report/sla` (EP3-07, sección 3.6). */
export interface SlaAlert {
  requestId: string;
  folio: string | null;
  procedureType: string;
  procedureLabel: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Fecha civil YYYY-MM-DD en hora de Chile. */
  dueDate: string;
  slaStatus: SlaAlertStatus;
}

export interface SlaAlertPage extends Page<SlaAlert> {
  lastEventAt: string | null;
}

export interface SlaAlertQuery {
  /** Sin estados, report devuelve los dos. */
  status?: readonly SlaAlertStatus[];
  /** `me` para el Admin y el Auditor devuelve una lista vacía: nunca son responsables. */
  assignee?: 'me' | 'none';
  page: number;
  size: number;
}

/** Ítem de `GET /api/report/sla/batch`: `slaStatus` null es un trámite que report no conoce o tiene parcial. */
export interface SlaBatchItem {
  requestId: string;
  slaStatus: SlaStatus | null;
  dueDate: string | null;
}

/** Un ítem por `requestId` pedido, en el mismo orden (EP3-07, sección 3.7). */
export interface SlaBatch {
  items: SlaBatchItem[];
  lastEventAt: string | null;
}

/** report acepta hasta 50 ids por consulta, el `size` máximo del listado de requests. */
export const SLA_BATCH_MAX = 50;

/** Ítem de `GET /api/report/map-points`: solo trámites con latitud y longitud (EP3-07, sección 3.8). */
export interface MapPoint {
  requestId: string;
  folio: string | null;
  latitude: number;
  longitude: number;
  status: RequestStatus;
  procedureType: string;
  procedureLabel: string | null;
  /** Código del sector de la comuna; null si el trámite no lo indicó. */
  sector: string | null;
}

export interface SectorCount {
  sector: string | null;
  count: number;
}

/** `GET /api/report/map-points` (EP3-07, sección 3.8). Totales y sectores no dependen del tope de `items`. */
export interface ReportMapPoints {
  range: ReportRange;
  items: MapPoint[];
  locatedTotal: number;
  withoutLocation: number;
  /** Suma `locatedTotal + withoutLocation`; el ítem con `sector` null va al final. */
  bySector: SectorCount[];
  lastEventAt: string | null;
}

export interface MapPointsQuery {
  range: ReportRange;
  /** Sin estados, report devuelve todos. */
  status: readonly RequestStatus[];
  procedureType: string | null;
}

/** Tope de puntos por respuesta de report. */
export const MAP_POINTS_MAX = 1000;
export const DEFAULT_MAP_RANGE: ReportRange = 'last7d';
