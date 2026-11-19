import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { MAP_STATUS_GROUPS, mapSymbolSvg } from '../report-map/map-status';

/** Leyenda con los mismos símbolos de los marcadores. */
@Component({
  selector: 'app-report-map-legend',
  template: `
    <ul class="legend" aria-label="Leyenda del mapa">
      @for (item of items; track item.label) {
        <li class="legend__item">
          <span class="legend__symbol" [innerHTML]="item.symbol"></span>
          {{ item.label }}
        </li>
      }
    </ul>
  `,
  styles: `
    @use 'tokens' as *;

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: $space-2 $space-6;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: calc(#{$font-body-sm} * var(--bd-text-scale, 1));
    }

    .legend__item {
      display: inline-flex;
      align-items: center;
      gap: $space-2;
    }

    .legend__symbol {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportMapLegendComponent {
  // El SVG es una constante propia, sin datos externos: no hay contenido que sanitizar
  protected readonly items: { label: string; symbol: SafeHtml }[] = MAP_STATUS_GROUPS.map(
    (group) => ({
      label: group.label,
      symbol: inject(DomSanitizer).bypassSecurityTrustHtml(mapSymbolSvg(group, 16)),
    }),
  );
}
