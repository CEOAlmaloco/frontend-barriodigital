import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CookieConsentService } from '../../core/cookies/cookie-consent.service';
import { BrandLogoVerticalComponent } from '../../shared/components/brand-logo/brand-logo-vertical.component';
import { SiteLegalLinksComponent } from '../../shared/components/site-legal-links/site-legal-links.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [BrandLogoVerticalComponent, MatButton, MatProgressSpinner, SiteLegalLinksComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cookies = inject(CookieConsentService);

  protected readonly isLoading = this.auth.isInteractionInProgress;
  protected readonly hasError = this.auth.loginFailed;
  protected readonly supportEmail = environment.supportEmail;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigateByUrl('/inicio', { replaceUrl: true });
      }
    });
  }

  protected signIn(): void {
    this.auth.login();
  }

  protected openCookieSettings(): void {
    this.cookies.requestOpen();
  }
}
