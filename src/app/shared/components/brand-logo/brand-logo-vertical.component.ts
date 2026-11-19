import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

import { BRAND_WORDMARK } from './brand-logo.paths';

/**
 * Logo completo, con el símbolo sobre el nombre. Va aparte de BrandLogoComponent porque solo lo usan login y
 * sin acceso, que se cargan bajo demanda: así su dibujo no pesa en el bundle inicial del header.
 */
@Component({
  selector: 'app-brand-logo-vertical',
  templateUrl: './brand-logo-vertical.component.html',
  styleUrl: './brand-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoVerticalComponent {
  /** true cuando un texto cercano ya nombra la marca, como un título. */
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly wordmark = BRAND_WORDMARK;
}
