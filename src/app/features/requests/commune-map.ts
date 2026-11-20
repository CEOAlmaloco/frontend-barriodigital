import L from 'leaflet';

import { COMMUNE_BOUNDS, MAP_CENTER } from './request-location';

export const COMMUNE_MAP_MAX_ZOOM = 18;

export interface CommuneMapOptions {
  /** En false la rueda no hace zoom, para que el scroll de la página no quede atrapado en el mapa. */
  scrollWheelZoom: boolean;
  /** En false, sin animaciones de zoom ni de desvanecido. */
  animate: boolean;
  /**
   * 0 = se puede salir del área; 1 = el arrastre no sale de la caja.
   * Con 1 y el zoom que muestra toda la comuna, Leaflet bloquea el pan: no queda margen.
   */
  maxBoundsViscosity?: number;
  /** Expande la caja de `maxBounds` (ratio de Leaflet) para dejar margen al moverse. */
  boundsPad?: number;
  /**
   * En false no aplica `maxBounds` (pan libre). Útil en el mapa de Reportes, donde el
   * encuadre de toda la comuna dejaba el arrastre bloqueado.
   */
  constrainToCommune?: boolean;
}

/** Caja estricta de la comuna (sin pad). */
export function communeLatLngBounds(): L.LatLngBounds {
  return L.latLngBounds(
    [COMMUNE_BOUNDS.south, COMMUNE_BOUNDS.west],
    [COMMUNE_BOUNDS.north, COMMUNE_BOUNDS.east],
  );
}

/** Mapa de la comuna con mosaicos de OpenStreetMap y controles en español. */
export function createCommuneMap(element: HTMLElement, options: CommuneMapOptions): L.Map {
  const bounds = communeLatLngBounds();
  const pad = options.boundsPad ?? 0;
  const constrain = options.constrainToCommune !== false;
  const map = L.map(element, {
    ...(constrain
      ? {
          maxBounds: pad > 0 ? bounds.pad(pad) : bounds,
          maxBoundsViscosity: options.maxBoundsViscosity ?? 1,
        }
      : {}),
    scrollWheelZoom: options.scrollWheelZoom,
    zoomControl: false,
    zoomAnimation: options.animate,
    fadeAnimation: options.animate,
    markerZoomAnimation: options.animate,
  });
  L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
  map.setView([MAP_CENTER.latitude, MAP_CENTER.longitude], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: COMMUNE_MAP_MAX_ZOOM,
  }).addTo(map);
  return map;
}

/** Sin movimiento si el sistema lo pide o si la persona lo pausó en el control de accesibilidad. */
export function prefersReducedMotion(document: Document): boolean {
  return (
    document.documentElement.dataset['bdMotion'] === 'on' ||
    (document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  );
}
