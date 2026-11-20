import { ReportKpis, SlaAlertPage } from '../../../shared/models/report.model';
import {
  HomeOpsSnapshot,
  openTotal,
  toOpsTiles,
  toPerfMetrics,
  toStatusRows,
} from './home-ops-tiles';

const kpis = (): ReportKpis => ({
  range: 'last24h',
  requestsOverTime: {
    bucket: 'HOUR',
    points: [
      { bucketStart: '2026-11-13T16:00:00Z', count: 4 },
      { bucketStart: '2026-11-13T17:00:00Z', count: 10 },
    ],
  },
  activeByStatus: { INGRESADO: 12, ADMITIDO: 7, EN_GESTION: 5, EN_TERRENO: 2 },
  averageResolutionHours: 31.5,
  resolvedCount: 8,
  slaCompliance: { rate: 0.875, onTime: 7, late: 1 },
  lastEventAt: '2026-11-13T17:58:12Z',
});

const overdue = (totalElements: number): SlaAlertPage => ({
  content: [],
  page: 0,
  size: 1,
  totalElements,
  totalPages: totalElements > 0 ? 1 : 0,
  lastEventAt: null,
});

describe('home-ops-tiles', () => {
  const snapshot = (total = 3): HomeOpsSnapshot => ({ kpis: kpis(), overdue: overdue(total) });

  it('arma los seis KPIs operativos sin clonar los de reportes', () => {
    const tiles = toOpsTiles(snapshot(3));
    expect(tiles.map((tile) => tile.label)).toEqual([
      'Ingresados',
      'Pendientes de admisión',
      'En gestión',
      'En terreno',
      'Resueltos',
      'Fuera de plazo',
    ]);
    expect(tiles[0].value).toBe('14');
    expect(tiles[0].meta).toBe('Últimas 24 horas');
    expect(tiles[1].value).toBe('12');
    expect(tiles[1].link).toEqual({ status: 'INGRESADO', open: 'true' });
    expect(tiles[4].value).toBe('8');
    expect(tiles[5].value).toBe('3');
    expect(tiles[5].fragment).toBe('home-overdue');
    expect(tiles[5].warn).toBe(true);
  });

  it('suma solo estados activos abiertos', () => {
    expect(openTotal(kpis())).toBe(26);
    expect(toStatusRows(kpis()).map((row) => row.count)).toEqual([12, 7, 5, 2]);
  });

  it('arma métricas de rendimiento sin repetir conteos operativos', () => {
    const metrics = toPerfMetrics(kpis());
    expect(metrics.map((m) => m.id)).toEqual(['avg', 'sla']);
    expect(metrics[0].value).toBeTruthy();
    expect(metrics[1].value).toMatch(/%/);
  });
});
