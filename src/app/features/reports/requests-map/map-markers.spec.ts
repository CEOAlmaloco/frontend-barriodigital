import { MapPoint } from '../../../shared/models/report.model';
import { pointName, sectorName, toPointView } from '../report-map/map-point-view';
import { MAP_STATUS_GROUPS, mapStatusGroup } from '../report-map/map-status';
import { buildPopupContent, clusterHtml, escapeHtml, markerHtml } from './map-markers';

const point = (overrides: Partial<MapPoint> = {}): MapPoint => ({
  requestId: 'req-1',
  folio: 'BD-2026-000123',
  latitude: -37.93,
  longitude: -71.31,
  status: 'EN_TERRENO',
  procedureType: 'bache',
  procedureLabel: 'Bache en calle',
  sector: 'ralco',
  ...overrides,
});

describe('Grupos de estado del mapa', () => {
  it('cubren los siete estados una sola vez, con una forma distinta por grupo', () => {
    const statuses = MAP_STATUS_GROUPS.flatMap((group) => group.statuses);

    expect(statuses).toHaveLength(7);
    expect(new Set(statuses).size).toBe(7);
    expect(new Set(MAP_STATUS_GROUPS.map((group) => group.shape)).size).toBe(4);
  });

  it('separa En terreno de los otros abiertos', () => {
    expect(mapStatusGroup('EN_TERRENO').label).toBe('En terreno');
    expect(mapStatusGroup('EN_GESTION').label).toBe('Otros abiertos');
    expect(mapStatusGroup('CANCELADO').label).toBe('Rechazado o cancelado');
  });
});

describe('Vista de un punto', () => {
  it('prefiere el nombre del catálogo, luego el de report y al final el código', () => {
    expect(toPointView(point(), 'Bache o hundimiento').typeLabel).toBe('Bache o hundimiento');
    expect(toPointView(point(), undefined).typeLabel).toBe('Bache en calle');
    expect(toPointView(point({ procedureLabel: '  ' }), undefined).typeLabel).toBe('bache');
  });

  it('nombra el sector y muestra tal cual un código que no conoce', () => {
    expect(sectorName('trapa-trapa')).toBe('Trapa Trapa');
    expect(sectorName('sector-nuevo')).toBe('sector-nuevo');
    expect(sectorName(null)).toBe('Sin sector');
    expect(sectorName(' ')).toBe('Sin sector');
  });

  it('el nombre accesible lleva folio, tipo y estado, también sin folio', () => {
    expect(pointName(toPointView(point(), undefined))).toBe(
      'BD-2026-000123, Bache en calle, En terreno',
    );
    expect(pointName(toPointView(point({ folio: null }), undefined))).toContain(
      'Trámite sin folio',
    );
  });
});

describe('Marcadores y fichas', () => {
  it('escapa el HTML de los textos del backend en el marcador', () => {
    const html = markerHtml(
      toPointView(point({ procedureLabel: '<img src=x onerror=alert(1)>' }), undefined),
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('el grupo anuncia cuántos trámites junta, en singular y en plural', () => {
    expect(clusterHtml(1)).toContain('1 trámite agrupado. Acercar');
    expect(clusterHtml(1000)).toContain('1.000 trámites agrupados');
  });

  it('la ficha muestra folio, tipo, estado y sector como texto y enlaza al detalle', () => {
    const onNavigate = vi.fn();
    const body = buildPopupContent(
      document,
      toPointView(point({ procedureLabel: '<b>Bache</b>' }), undefined),
      { href: '/tramites/req-1', onNavigate },
    );
    const link = body.querySelector<HTMLAnchorElement>('a')!;

    expect(body.querySelector('.map-popup__folio')?.textContent).toBe('BD-2026-000123');
    expect(body.querySelector('.map-popup__type')?.textContent).toBe('<b>Bache</b>');
    expect(body.querySelector('b')).toBeNull();
    expect(body.querySelector('.map-popup__status')?.textContent).toBe('En terreno');
    expect(body.textContent).toContain('Ralco');
    expect(link.getAttribute('href')).toBe('/tramites/req-1');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(click);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);
  });

  it('con Ctrl o Cmd deja que el navegador abra el enlace en otra pestaña', () => {
    const onNavigate = vi.fn();
    const link = buildPopupContent(document, toPointView(point(), undefined), {
      href: '/tramites/req-1',
      onNavigate,
    }).querySelector('a')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });

    link.dispatchEvent(click);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(false);
  });
});
