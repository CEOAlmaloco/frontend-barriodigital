import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

import { COMMUNE_BOUNDS, MAP_CENTER, roundCoordinate } from './request-location';

@Component({
  selector: 'app-request-location-map',
  template: `
    <div
      #canvas
      class="request-map"
      role="application"
      aria-label="Mapa de la comuna. Haz clic para marcar el punto del trámite."
    ></div>
  `,
  styleUrl: './request-location-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestLocationMapComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly pointSelected = output<{ latitude: number; longitude: number }>();

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private icon: L.DivIcon | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => this.start());
    effect(() => {
      const latitude = this.latitude();
      const longitude = this.longitude();
      if (this.map && latitude != null && longitude != null) {
        this.moveMarker(latitude, longitude);
      }
    });
    destroyRef.onDestroy(() => {
      this.map?.remove();
      this.map = null;
    });
  }

  private start(): void {
    const element = this.canvas().nativeElement;
    const bounds = L.latLngBounds(
      [COMMUNE_BOUNDS.south, COMMUNE_BOUNDS.west],
      [COMMUNE_BOUNDS.north, COMMUNE_BOUNDS.east],
    );
    const map = L.map(element, {
      maxBounds: bounds,
      maxBoundsViscosity: 1,
    });
    map.setView([MAP_CENTER.latitude, MAP_CENTER.longitude], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      const latitude = roundCoordinate(event.latlng.lat);
      const longitude = roundCoordinate(event.latlng.lng);
      this.moveMarker(latitude, longitude);
      this.pointSelected.emit({ latitude, longitude });
    });
    this.map = map;
    const latitude = this.latitude();
    const longitude = this.longitude();
    if (latitude != null && longitude != null) {
      this.moveMarker(latitude, longitude);
      map.setView([latitude, longitude], 15);
    }
    requestAnimationFrame(() => map.invalidateSize());
  }

  private moveMarker(latitude: number, longitude: number): void {
    if (!this.map) {
      return;
    }
    const position = L.latLng(latitude, longitude);
    if (!this.marker) {
      this.marker = L.marker(position, { icon: this.pin(), keyboard: false }).addTo(this.map);
      return;
    }
    this.marker.setLatLng(position);
  }

  private pin(): L.DivIcon {
    if (this.icon) {
      return this.icon;
    }
    const style = getComputedStyle(this.host.nativeElement);
    const primary = style.getPropertyValue('--bd-primary').trim() || 'currentColor';
    const surface = style.getPropertyValue('--bd-surface').trim() || 'transparent';
    this.icon = L.divIcon({
      className: 'request-map__pin',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${primary};border:2px solid ${surface}"></span>`,
    });
    return this.icon;
  }
}
