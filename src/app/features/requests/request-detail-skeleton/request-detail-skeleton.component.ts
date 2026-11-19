import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Silueta del detalle mientras llega el trámite, con la misma grilla que la vista cargada. */
@Component({
  selector: 'app-request-detail-skeleton',
  template: `
    <div class="skeleton-page" role="status">
      <span class="cdk-visually-hidden">Cargando el trámite.</span>
      <div class="skeleton-page__head" aria-hidden="true">
        <span class="bone bone--short"></span>
        <span class="bone bone--title"></span>
        <span class="bone bone--medium"></span>
      </div>
      <div class="skeleton-page__grid" aria-hidden="true">
        <div class="skeleton-page__card skeleton-page__aside">
          <span class="bone bone--medium"></span>
          <span class="bone bone--button"></span>
          <span class="bone bone--button"></span>
        </div>
        <div class="skeleton-page__main">
          <div class="skeleton-page__card">
            <span class="bone bone--short"></span>
            <span class="bone"></span>
            <span class="bone"></span>
            <span class="bone bone--medium"></span>
          </div>
          <div class="skeleton-page__card">
            <span class="bone bone--block"></span>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './request-detail-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetailSkeletonComponent {}
