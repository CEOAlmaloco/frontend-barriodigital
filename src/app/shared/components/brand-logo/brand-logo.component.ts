import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

import { BRAND_WORDMARK } from './brand-logo.paths';

/** horizontal: header. symbol: header móvil y espacios pequeños. La vertical es BrandLogoVerticalComponent. */
export type BrandLogoVariant = 'horizontal' | 'symbol';

/**
 * Logo oficial en SVG en línea: sus colores salen de los tokens --bd-brand-*, que cambian con el modo de
 * contraste. La altura la fija quien lo usa; el ancho sigue la proporción de cada versión.
 */
@Component({
  selector: 'app-brand-logo',
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {
  readonly variant = input<BrandLogoVariant>('symbol');
  /** true cuando un texto cercano ya nombra la marca, como un enlace o un título. */
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly wordmark = BRAND_WORDMARK;
}
