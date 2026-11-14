import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import L from 'leaflet';
import 'leaflet.markercluster';

import { createCommuneMap, prefersReducedMotion } from '../../requests/commune-map';
import { MapPointView } from '../report-map/map-point-view';
import {
  MARKER_SIZE,
  buildPopupContent,
  clusterHtml,
  clusterSize,
  markerHtml,
} from './map-markers';

interface MarkerEntry {
  marker: L.Marker;
  position: string;
  signature: string;
}

/** Zoom con el que «Ver todos» enfoca un solo punto o un grupo muy junto. */
const FIT_MAX_ZOOM = 15;
const FIT_PADDING: L.PointExpression = [32, 32];

/**
 * Trámites en el mapa de la comuna, agrupados cuando se superponen. Un grupo se abre al acercarse y, en el zoom
 * máximo, despliega en abanico los puntos con la misma coordenada. Las actualizaciones del polling cambian solo
 * los marcadores que cambiaron, así se conservan el zoom, la posición y la ficha abierta; el mapa se reencuadra
 * solo cuando llegan los datos de otro filtro (`fitKey`).
 */
@Component({
  selector: 'app-requests-map',
  imports: [MatIcon, MatProgressBar],
  template: `
    @if (busy()) {
      <mat-progress-bar class="requests-map__progress" mode="indeterminate" aria-hidden="true" />
    }
    <div
      #canvas
      class="requests-map__canvas bd-map"
      [class.bd-map--busy]="busy()"
      role="region"
      aria-roledescription="mapa"
      aria-label="Mapa de trámites"
      [attr.aria-busy]="busy()"
    ></div>
    @if (points().length) {
      <button type="button" class="requests-map__fit" (click)="fitAll()">
        <mat-icon aria-hidden="true">fit_screen</mat-icon>
        Ver todos
      </button>
    }
    <ng-content />
  `,
  styleUrl: './requests-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsMapComponent {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  readonly points = input.required<readonly MapPointView[]>();
  /** Los puntos son de otro filtro mientras llega la respuesta: se atenúan. */
  readonly busy = input(false);
  /** Al cambiar, el mapa se reencuadra con los primeros datos que lleguen para esa clave. */
  readonly fitKey = input.required<string>();
  /** El mapa sigue montado en la vista Lista para no perder el zoom; al volver se recalcula su tamaño. */
  readonly visible = input(true);

  private readonly ready = signal(false);
  private map: L.Map | null = null;
  private cluster: L.MarkerClusterGroup | null = null;
  private readonly entries = new Map<string, MarkerEntry>();
  private readonly views = new Map<string, MapPointView>();
  private fittedKey: string | null = null;

  constructor() {
    afterNextRender(() => this.start());

    effect(() => {
      const points = this.points();
      if (this.ready()) {
        untracked(() => this.sync(points));
      }
    });

    effect(() => {
      const key = this.fitKey();
      const busy = this.busy();
      const visible = this.visible();
      if (!this.ready() || busy || !visible || key === this.fittedKey) {
        return;
      }
      this.fittedKey = key;
      untracked(() => this.fitAll(false));
    });

    effect(() => {
      if (this.visible() && this.ready()) {
        requestAnimationFrame(() => this.map?.invalidateSize());
      }
    });

    // Sin capas ni eventos antes de remove: una animación de zoom pendiente no toca un mapa ya destruido
    inject(DestroyRef).onDestroy(() => {
      this.cluster?.clearLayers();
      this.map?.off();
      this.map?.stop();
      this.map?.remove();
      this.map = null;
      this.cluster = null;
    });
  }

  protected fitAll(animate = true): void {
    const bounds = this.cluster?.getBounds();
    if (this.map && bounds?.isValid()) {
      this.map.fitBounds(bounds, {
        padding: FIT_PADDING,
        maxZoom: FIT_MAX_ZOOM,
        animate: animate && !prefersReducedMotion(this.document),
      });
    }
  }

  private start(): void {
    const animate = !prefersReducedMotion(this.document);
    const map = createCommuneMap(this.canvas().nativeElement, {
      scrollWheelZoom: false,
      animate,
    });
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 48,
      chunkedLoading: true,
      animate,
      spiderLegPolylineOptions: { className: 'map-spider-leg', weight: 1.5, opacity: 0.9 },
      iconCreateFunction: (group) => {
        const count = group.getChildCount();
        const size = clusterSize(count);
        return L.divIcon({
          className: 'map-cluster',
          html: clusterHtml(count),
          iconSize: [size, size],
        });
      },
    });
    cluster.on('clusterclick', (event) => this.keepFocusAfterZoom(event.propagatedFrom));
    map.addLayer(cluster);
    map.on('popupopen', (event) => this.onPopupOpen(event.popup));
    map.on('popupclose', (event) => this.onPopupClose(event.popup));
    this.map = map;
    this.cluster = cluster;
    this.ready.set(true);
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  private sync(points: readonly MapPointView[]): void {
    const cluster = this.cluster;
    if (!cluster) {
      return;
    }
    const next = new Set(points.map((point) => point.requestId));
    const removed: L.Marker[] = [];
    const added: L.Marker[] = [];

    for (const [id, entry] of this.entries) {
      if (!next.has(id)) {
        removed.push(entry.marker);
        this.entries.delete(id);
        this.views.delete(id);
      }
    }

    for (const point of points) {
      this.views.set(point.requestId, point);
      const position = `${point.latitude},${point.longitude}`;
      const signature = `${point.folio}|${point.status}|${point.typeLabel}|${point.sectorLabel}`;
      const entry = this.entries.get(point.requestId);
      if (entry && entry.position === position) {
        if (entry.signature !== signature) {
          entry.signature = signature;
          entry.marker.setIcon(this.icon(point));
          entry.marker.getPopup()?.update();
        }
        continue;
      }
      if (entry) {
        removed.push(entry.marker);
      }
      const marker = this.createMarker(point);
      this.entries.set(point.requestId, { marker, position, signature });
      added.push(marker);
    }

    if (removed.length) cluster.removeLayers(removed);
    if (added.length) cluster.addLayers(added);
  }

  private createMarker(point: MapPointView): L.Marker {
    const id = point.requestId;
    const marker = L.marker([point.latitude, point.longitude], {
      icon: this.icon(point),
      keyboard: true,
      riseOnHover: true,
    });
    marker.bindPopup(() => this.popupContent(id), {
      className: 'map-popup',
      maxWidth: 280,
      autoPanPadding: [24, 24],
    });
    return marker;
  }

  private icon(point: MapPointView): L.DivIcon {
    return L.divIcon({
      className: 'map-marker',
      html: markerHtml(point),
      iconSize: [MARKER_SIZE, MARKER_SIZE],
      popupAnchor: [0, -MARKER_SIZE / 2],
    });
  }

  private popupContent(id: string): HTMLElement {
    const view = this.views.get(id)!;
    const tree = this.router.createUrlTree(['/tramites', id]);
    return buildPopupContent(this.document, view, {
      href: this.router.serializeUrl(tree),
      onNavigate: () => this.router.navigateByUrl(tree),
    });
  }

  /** Ficha como diálogo con nombre en español; si se abrió con el teclado, el foco pasa al enlace. */
  private onPopupOpen(popup: L.Popup): void {
    const element = popup.getElement();
    if (!element) {
      return;
    }
    const folio = element.querySelector('.map-popup__folio')?.textContent ?? 'Trámite';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', folio);
    element
      .querySelector('.leaflet-popup-close-button')
      ?.setAttribute('aria-label', 'Cerrar ficha');
    const source = this.sourceElement(popup);
    if (source && this.document.activeElement === source) {
      element.querySelector<HTMLElement>('.map-popup__link')?.focus();
    }
  }

  /** Al cerrar con Escape o con la cruz, el foco vuelve al marcador en vez de perderse en la página. */
  private onPopupClose(popup: L.Popup): void {
    const element = popup.getElement();
    if (!element?.contains(this.document.activeElement)) {
      return;
    }
    const source = this.sourceElement(popup);
    (source?.isConnected ? source : this.canvas().nativeElement).focus();
  }

  private sourceElement(popup: L.Popup): HTMLElement | null {
    const source = (popup as L.Popup & { _source?: L.Layer })._source;
    return source instanceof L.Marker ? (source.getElement() ?? null) : null;
  }

  /** El grupo desaparece al acercarse: si tenía el foco, este pasa al mapa. */
  private keepFocusAfterZoom(layer: L.Layer | undefined): void {
    const element = layer instanceof L.Marker ? layer.getElement() : undefined;
    if (!element || this.document.activeElement !== element) {
      return;
    }
    this.map?.once('moveend', () => {
      if (!element.isConnected) {
        this.canvas().nativeElement.focus();
      }
    });
  }
}
