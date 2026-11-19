import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import L from 'leaflet';

import { createCommuneMap, prefersReducedMotion } from './commune-map';
import { roundCoordinate } from './request-location';

const PIN_SIZE = 18;

/** Sin encapsulación: Leaflet crea su propio DOM y el estilo del pin debe alcanzarlo. Controles en `_map.scss`. */
@Component({
  selector: 'app-request-location-map',
  template: `
    <div
      #canvas
      class="request-map bd-map"
      role="region"
      aria-roledescription="mapa"
      [attr.aria-label]="
        selectable() ? 'Mapa de la comuna. Haz clic para marcar el punto del trámite.' : label()
      "
    ></div>
  `,
  styleUrl: './request-location-map.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestLocationMapComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly document = inject(DOCUMENT);

  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  /**
   * En true un clic marca el punto. En false el mapa solo lo muestra, aunque se puede mover y acercar;
   * la rueda no hace zoom para que el scroll de la página no quede atrapado en el mapa.
   */
  readonly selectable = input(true);
  readonly label = input('Mapa con el punto del trámite');
  readonly pointSelected = output<{ latitude: number; longitude: number }>();

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

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
    const selectable = this.selectable();
    const map = createCommuneMap(this.canvas().nativeElement, {
      scrollWheelZoom: selectable,
      animate: !prefersReducedMotion(this.document),
    });
    if (selectable) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        const latitude = roundCoordinate(event.latlng.lat);
        const longitude = roundCoordinate(event.latlng.lng);
        this.moveMarker(latitude, longitude);
        this.pointSelected.emit({ latitude, longitude });
      });
    }
    this.map = map;
    const latitude = this.latitude();
    const longitude = this.longitude();
    if (latitude != null && longitude != null) {
      this.moveMarker(latitude, longitude);
      map.setView([latitude, longitude], 15);
    }
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  private moveMarker(latitude: number, longitude: number): void {
    if (!this.map) {
      return;
    }
    const position = L.latLng(latitude, longitude);
    if (!this.marker) {
      const icon = L.divIcon({
        className: 'request-map__pin',
        iconSize: [PIN_SIZE, PIN_SIZE],
        iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
      });
      this.marker = L.marker(position, { icon, keyboard: false }).addTo(this.map);
      return;
    }
    this.marker.setLatLng(position);
  }
}
