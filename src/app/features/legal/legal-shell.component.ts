import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CookieConsentService } from '../../core/cookies/cookie-consent.service';
import { environment } from '../../../environments/environment';

/** Contenedor de páginas legales públicas con navegación entre ellas. */
@Component({
  selector: 'app-legal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './legal-shell.component.html',
  styleUrl: './legal-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalShellComponent {
  private readonly cookies = inject(CookieConsentService);
  protected readonly supportEmail = environment.supportEmail;

  protected openCookieSettings(): void {
    this.cookies.requestOpen();
  }
}
