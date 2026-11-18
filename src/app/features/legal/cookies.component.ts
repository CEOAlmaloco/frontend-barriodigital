import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CookieConsentService } from '../../core/cookies/cookie-consent.service';

@Component({
  selector: 'app-legal-cookies',
  templateUrl: './cookies.component.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalCookiesComponent {
  private readonly cookies = inject(CookieConsentService);

  protected openSettings(): void {
    this.cookies.requestOpen();
  }
}
