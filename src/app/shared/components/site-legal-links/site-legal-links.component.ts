import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';

/** Enlaces legales públicos reutilizables (login, pie, páginas legales). */
@Component({
  selector: 'app-site-legal-links',
  imports: [RouterLink],
  templateUrl: './site-legal-links.component.html',
  styleUrl: './site-legal-links.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteLegalLinksComponent {
  /** Incluye el mailto de contacto. */
  readonly showContact = input(true);
  /** Incluye el control para reabrir configuración de cookies. */
  readonly showCookieSettings = input(false);
  /** Se emite al pedir configurar cookies. */
  readonly cookieSettings = output<void>();

  protected readonly supportEmail = environment.supportEmail;
}
