import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';

import { RequestStatusBadgeComponent } from '../../requests/request-status-badge/request-status-badge.component';
import { REQUEST_PAGE_SIZES } from '../../requests/request-list-query';
import { MapPointView } from '../report-map/map-point-view';

/**
 * Los mismos trámites del mapa en una tabla: la alternativa para recorrerlos con teclado o lector de pantalla.
 * Pagina en el navegador porque report ya los entrega todos, del alta más reciente a la más antigua.
 */
@Component({
  selector: 'app-report-map-list',
  imports: [MatPaginator, RequestStatusBadgeComponent, RouterLink],
  templateUrl: './report-map-list.component.html',
  styleUrl: './report-map-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportMapListComponent {
  readonly points = input.required<readonly MapPointView[]>();
  /** Otro filtro vuelve a la primera página; el polling con el mismo filtro conserva la página. */
  readonly resetKey = input.required<string>();
  readonly busy = input(false);

  protected readonly pageSizes = REQUEST_PAGE_SIZES;
  protected readonly pageSize = signal(REQUEST_PAGE_SIZES[0]);
  private readonly requestedPage = signal(0);

  /** Si el polling deja menos trámites, la página se ajusta a la última que existe. */
  protected readonly pageIndex = computed(() => {
    const last = Math.max(0, Math.ceil(this.points().length / this.pageSize()) - 1);
    return Math.min(this.requestedPage(), last);
  });

  protected readonly rows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.points().slice(start, start + this.pageSize());
  });

  constructor() {
    effect(() => {
      this.resetKey();
      this.requestedPage.set(0);
    });
  }

  protected changePage(event: PageEvent): void {
    this.pageSize.set(event.pageSize);
    this.requestedPage.set(event.pageIndex);
  }
}
