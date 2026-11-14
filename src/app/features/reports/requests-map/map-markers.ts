import { formatCount, plural } from '../report-format';
import { mapSymbolSvg } from '../report-map/map-status';
import { MapPointView, pointName } from '../report-map/map-point-view';

/** Área táctil del marcador: 2.5.8 de WCAG 2.2 pide al menos 24 × 24 px. */
export const MARKER_SIZE = 28;
const SYMBOL_SIZE = 20;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Los textos vienen del backend y Leaflet los inserta como HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Símbolo del estado y nombre accesible: el marcador es un botón de Leaflet y lo anuncia con este texto. */
export function markerHtml(view: MapPointView): string {
  return (
    mapSymbolSvg(view.group, SYMBOL_SIZE) +
    `<span class="cdk-visually-hidden">${escapeHtml(pointName(view))}</span>`
  );
}

export function clusterSize(count: number): number {
  if (count < 10) return 36;
  if (count < 100) return 42;
  return 50;
}

export function clusterHtml(count: number): string {
  const label = `${plural(count, 'trámite agrupado', 'trámites agrupados')}. Acercar`;
  return (
    `<span aria-hidden="true">${formatCount(count)}</span>` +
    `<span class="cdk-visually-hidden">${label}</span>`
  );
}

export interface PopupContentOptions {
  href: string;
  onNavigate: () => void;
}

/**
 * Ficha del punto como DOM: los textos van por textContent, así un nombre con HTML no se interpreta. Un clic
 * simple navega dentro de la app; con Ctrl, Cmd o Shift el navegador abre el enlace como siempre.
 */
export function buildPopupContent(
  document: Document,
  view: MapPointView,
  options: PopupContentOptions,
): HTMLElement {
  const body = document.createElement('div');
  body.className = 'map-popup__body';

  const folio = document.createElement('span');
  folio.className = 'map-popup__folio';
  folio.textContent = view.folio ?? 'Trámite sin folio';

  const type = document.createElement('span');
  type.className = 'map-popup__type';
  type.textContent = view.typeLabel;

  const meta = document.createElement('span');
  meta.className = 'map-popup__meta';
  const status = document.createElement('span');
  status.className = 'map-popup__status';
  status.innerHTML = mapSymbolSvg(view.group, 14);
  status.append(view.statusLabel);
  const sector = document.createElement('span');
  sector.textContent = view.sectorLabel;
  meta.append(status, sector);

  const link = document.createElement('a');
  link.className = 'map-popup__link';
  link.href = options.href;
  link.textContent = 'Ver trámite';
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    options.onNavigate();
  });

  body.append(folio, type, meta, link);
  return body;
}
