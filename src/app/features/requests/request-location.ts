import { AbstractControl, ValidationErrors } from '@angular/forms';

import { Request } from '../../shared/models/request.model';

/** Misma caja que LocationRules en requests: la comuna de Alto Biobío, con holgura en el borde. */
export const COMMUNE_BOUNDS = {
  north: -37.6,
  south: -38.25,
  west: -71.8,
  east: -71,
} as const;

/** Centro del mapa: Ralco, cabecera comunal. */
export const MAP_CENTER = {
  latitude: -37.933,
  longitude: -71.317,
} as const;

export const COMMUNE_SECTORS = [
  { value: 'ralco', label: 'Ralco' },
  { value: 'villa-ralco', label: 'Villa Ralco' },
  { value: 'pitril', label: 'Pitril' },
  { value: 'caunicu', label: 'Cauñicú' },
  { value: 'quepuca', label: 'Quepuca' },
  { value: 'butalelbun', label: 'Butalelbún' },
  { value: 'malla', label: 'Malla' },
  { value: 'trapa-trapa', label: 'Trapa Trapa' },
  { value: 'el-barco', label: 'El Barco' },
  { value: 'otro', label: 'Otro sector de la comuna' },
] as const;

export type LocationMode = 'ninguno' | 'gps' | 'mapa' | 'coordenadas';

export function isInsideCommune(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= COMMUNE_BOUNDS.south &&
    latitude <= COMMUNE_BOUNDS.north &&
    longitude >= COMMUNE_BOUNDS.west &&
    longitude <= COMMUNE_BOUNDS.east
  );
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function sectorLabel(code: string | null | undefined): string | null {
  return COMMUNE_SECTORS.find((sector) => sector.value === code)?.label ?? null;
}

export function locationSummary(request: Request): string | null {
  const parts: string[] = [];
  const sector = sectorLabel(request.sector);
  if (sector) {
    parts.push(sector);
  }
  const reference = request.locationReference?.trim();
  if (reference) {
    parts.push(reference);
  }
  if (request.latitude != null && request.longitude != null) {
    const kind = request.locationPrecision === 'APROXIMADO' ? 'aproximado' : 'exacto';
    parts.push(`punto ${kind} ${request.latitude}, ${request.longitude}`);
  }
  return parts.length === 0 ? null : parts.join('. ');
}

export function mapUrl(request: Request): string | null {
  if (request.latitude == null || request.longitude == null) {
    return null;
  }
  const { latitude, longitude } = request;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

export function locationPointValidator(control: AbstractControl): ValidationErrors | null {
  const mode = control.get('locationMode')?.value as LocationMode | null;
  if (!mode || mode === 'ninguno') {
    return null;
  }
  const rawLatitude = control.get('latitude')?.value;
  const rawLongitude = control.get('longitude')?.value;
  if (rawLatitude == null || rawLatitude === '' || rawLongitude == null || rawLongitude === '') {
    return { pointRequired: true };
  }
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { pointRequired: true };
  }
  if (!isInsideCommune(latitude, longitude)) {
    return { outsideCommune: true };
  }
  return null;
}
