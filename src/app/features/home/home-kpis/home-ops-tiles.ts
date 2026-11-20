import {
  OPEN_REQUEST_STATUSES,
  ReportKpis,
  SlaAlertPage,
} from '../../../shared/models/report.model';
import { RequestStatus } from '../../../shared/models/request.model';
import { REQUEST_STATUS_VIEW } from '../../requests/requests.constants';
import { formatDuration } from '../../requests/duration';
import { formatCount, formatPercent } from '../../reports/report-format';

/** Respuesta conjunta del resumen operativo de /inicio (Admin). */
export interface HomeOpsSnapshot {
  kpis: ReportKpis;
  overdue: SlaAlertPage;
}

export type HomeOpsEmphasis = 'lead' | 'warn' | 'default';

export interface HomeOpsTile {
  id: string;
  label: string;
  value: string | null;
  empty: string;
  meta: string;
  icon: string;
  emphasis: HomeOpsEmphasis;
  /** Query params hacia /tramites cuando el filtro existe en requests. */
  link: Record<string, string> | null;
  /** Ancla interna cuando no hay filtro de listado (p. ej. plazos). */
  fragment: string | null;
  warn: boolean;
}

export interface HomeStatusRow {
  status: RequestStatus;
  label: string;
  count: number;
}

export interface HomePerfMetric {
  id: string;
  label: string;
  value: string | null;
  empty: string;
  meta: string;
}

/** Une KPIs de report con el total de vencidos de /sla. */
export function toOpsTiles(snapshot: HomeOpsSnapshot): HomeOpsTile[] {
  const { kpis, overdue } = snapshot;
  const byStatus = kpis.activeByStatus;
  const incoming = kpis.requestsOverTime.points.reduce((sum, point) => sum + point.count, 0);
  return [
    {
      id: 'incoming',
      label: 'Ingresados',
      value: formatCount(incoming),
      empty: '',
      meta: 'Últimas 24 horas',
      icon: 'south_west',
      emphasis: 'lead',
      link: { open: 'true', sort: 'createdAt,desc' },
      fragment: null,
      warn: false,
    },
    {
      id: 'admission',
      label: 'Pendientes de admisión',
      value: formatCount(byStatus.INGRESADO ?? 0),
      empty: '',
      meta: 'Requieren revisión',
      icon: 'inbox',
      emphasis: 'default',
      link: { status: 'INGRESADO', open: 'true' },
      fragment: null,
      warn: (byStatus.INGRESADO ?? 0) > 0,
    },
    {
      id: 'gestion',
      label: 'En gestión',
      value: formatCount(byStatus.EN_GESTION ?? 0),
      empty: '',
      meta: 'Ahora',
      icon: 'pending_actions',
      emphasis: 'default',
      link: { status: 'EN_GESTION', open: 'true' },
      fragment: null,
      warn: false,
    },
    {
      id: 'terreno',
      label: 'En terreno',
      value: formatCount(byStatus.EN_TERRENO ?? 0),
      empty: '',
      meta: 'Ahora',
      icon: 'map',
      emphasis: 'default',
      link: { status: 'EN_TERRENO', open: 'true' },
      fragment: null,
      warn: false,
    },
    {
      id: 'resolved',
      label: 'Resueltos',
      value: formatCount(kpis.resolvedCount),
      empty: '',
      meta: 'Últimas 24 horas',
      icon: 'task_alt',
      emphasis: 'lead',
      link: { status: 'RESUELTO', open: 'false' },
      fragment: null,
      warn: false,
    },
    {
      id: 'overdue',
      label: 'Fuera de plazo',
      value: formatCount(overdue.totalElements),
      empty: '',
      meta: 'Activos vencidos',
      icon: 'timer_off',
      emphasis: 'warn',
      link: null,
      fragment: 'home-overdue',
      warn: overdue.totalElements > 0,
    },
  ];
}

export function toStatusRows(kpis: ReportKpis): HomeStatusRow[] {
  return OPEN_REQUEST_STATUSES.map((status) => ({
    status,
    label: REQUEST_STATUS_VIEW[status].label,
    count: kpis.activeByStatus[status] ?? 0,
  }));
}

export function openTotal(kpis: ReportKpis): number {
  return OPEN_REQUEST_STATUSES.reduce((sum, status) => sum + (kpis.activeByStatus[status] ?? 0), 0);
}

/** Rendimiento del período: no repite los conteos de los KPIs principales. */
export function toPerfMetrics(kpis: ReportKpis): HomePerfMetric[] {
  const hours = kpis.averageResolutionHours;
  const { rate, onTime, late } = kpis.slaCompliance;
  const evaluated = onTime + late;
  return [
    {
      id: 'avg',
      label: 'Tiempo medio de resolución',
      value: hours === null ? null : formatDuration(hours * 3600),
      empty: 'Sin resueltos',
      meta:
        hours === null
          ? 'Ningún cierre en las últimas 24 horas'
          : `${formatCount(kpis.resolvedCount)} cierres en el período`,
    },
    {
      id: 'sla',
      label: 'Cumplimiento de plazo',
      value: rate === null ? null : formatPercent(rate),
      empty: 'Sin cierres evaluables',
      meta:
        rate === null
          ? 'Ningún cierre con plazo en las últimas 24 horas'
          : `${formatCount(onTime)} de ${formatCount(evaluated)} dentro de plazo`,
    },
  ];
}
