import { RequestStatus } from '../../../shared/models/request.model';

export type MapStatusGroup = 'open' | 'field' | 'resolved' | 'closed';
export type MapSymbolShape = 'circle' | 'diamond' | 'ring' | 'square';

export interface MapStatusGroupView {
  group: MapStatusGroup;
  label: string;
  shape: MapSymbolShape;
  statuses: readonly RequestStatus[];
}

/**
 * Grupos de la leyenda. En terreno se separa de los demás abiertos porque es el que organiza la salida a
 * terreno; los cerrados van huecos y los abiertos rellenos.
 */
export const MAP_STATUS_GROUPS: readonly MapStatusGroupView[] = [
  {
    group: 'open',
    label: 'Otros abiertos',
    shape: 'circle',
    statuses: ['INGRESADO', 'ADMITIDO', 'EN_GESTION'],
  },
  { group: 'field', label: 'En terreno', shape: 'diamond', statuses: ['EN_TERRENO'] },
  { group: 'resolved', label: 'Resuelto', shape: 'ring', statuses: ['RESUELTO'] },
  {
    group: 'closed',
    label: 'Rechazado o cancelado',
    shape: 'square',
    statuses: ['RECHAZADO', 'CANCELADO'],
  },
];

export function mapStatusGroup(status: RequestStatus): MapStatusGroupView {
  return MAP_STATUS_GROUPS.find((view) => view.statuses.includes(status)) ?? MAP_STATUS_GROUPS[0];
}

/** Geometría en un viewBox de 20 × 20; la misma para los marcadores y la leyenda. */
const SHAPES: Record<MapSymbolShape, string> = {
  circle: '<circle cx="10" cy="10" r="7.5"/>',
  diamond: '<path d="M10 1.5 18.5 10 10 18.5 1.5 10Z"/>',
  ring: '<circle cx="10" cy="10" r="6.5"/>',
  square: '<rect x="3.5" y="3.5" width="13" height="13" rx="1.5"/>',
};

/** SVG del símbolo para el DOM de Leaflet, que no pasa por las plantillas de Angular. */
export function mapSymbolSvg(group: MapStatusGroupView, size: number): string {
  return (
    `<svg class="map-symbol map-symbol--${group.group}" width="${size}" height="${size}" ` +
    `viewBox="0 0 20 20" aria-hidden="true" focusable="false">${SHAPES[group.shape]}</svg>`
  );
}
