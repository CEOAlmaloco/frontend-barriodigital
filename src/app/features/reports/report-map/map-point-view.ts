import { MapPoint } from '../../../shared/models/report.model';
import { RequestStatus } from '../../../shared/models/request.model';
import { sectorLabel } from '../../requests/request-location';
import { REQUEST_STATUS_VIEW } from '../../requests/requests.constants';
import { MapStatusGroupView, mapStatusGroup } from './map-status';

/** Punto listo para el mapa y la lista: nombres resueltos una sola vez para las dos vistas. */
export interface MapPointView {
  requestId: string;
  folio: string | null;
  latitude: number;
  longitude: number;
  status: RequestStatus;
  statusLabel: string;
  typeLabel: string;
  sectorLabel: string;
  group: MapStatusGroupView;
}

export const NO_SECTOR_LABEL = 'Sin sector';

/** Nombre del sector; un código que la interfaz no conoce se muestra tal cual en vez de ocultarse. */
export function sectorName(code: string | null): string {
  if (code === null || code.trim() === '') {
    return NO_SECTOR_LABEL;
  }
  return sectorLabel(code) ?? code;
}

/**
 * El nombre del tipo sale del catálogo, que refleja un renombre; sin catálogo, del que guardó report y, en
 * último caso, del código.
 */
export function toPointView(point: MapPoint, catalogLabel: string | undefined): MapPointView {
  return {
    requestId: point.requestId,
    folio: point.folio,
    latitude: point.latitude,
    longitude: point.longitude,
    status: point.status,
    statusLabel: REQUEST_STATUS_VIEW[point.status]?.label ?? point.status,
    typeLabel: catalogLabel ?? (point.procedureLabel?.trim() || point.procedureType),
    sectorLabel: sectorName(point.sector),
    group: mapStatusGroup(point.status),
  };
}

/** Nombre accesible del punto, el mismo en el marcador y en la ficha. */
export function pointName(view: MapPointView): string {
  return `${view.folio ?? 'Trámite sin folio'}, ${view.typeLabel}, ${view.statusLabel}`;
}
