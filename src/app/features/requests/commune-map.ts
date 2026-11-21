import L from 'leaflet';

import { COMMUNE_BOUNDS, MAP_CENTER } from './request-location';

export const COMMUNE_MAP_MAX_ZOOM = 18;

export interface CommuneMapOptions {
  /** En false la rueda no hace zoom, para que el scroll de la página no quede atrapado en el mapa. */
  scrollWheelZoom: boolean;
  /** En false, sin animaciones de zoom ni de desvanecido. */
  animate: boolean;
}

/** Mapa de la comuna con mosaicos de OpenStreetMap, acotado a la caja de requests y con controles en español. */
export function createCommuneMap(element: HTMLElement, options: CommuneMapOptions): L.Map {
  const map = L.map(element, {
    maxBounds: L.latLngBounds(
      [COMMUNE_BOUNDS.south, COMMUNE_BOUNDS.west],
      [COMMUNE_BOUNDS.north, COMMUNE_BOUNDS.east],
    ),
    maxBoundsViscosity: 1,
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
