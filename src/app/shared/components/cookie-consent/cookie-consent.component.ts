import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { filter, map, startWith } from 'rxjs';

import { CookieConsentService } from '../../../core/cookies/cookie-consent.service';

/**
 * Aviso de cookies: franja fija abajo, panel flotante y pie para volver a configurar.
 * En login/legal no muestra pie fijo: esas pantallas ya traen el enlace.
 */
@Component({
  selector: 'app-cookie-consent',
  imports: [MatSlideToggle, RouterLink],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieConsentComponent {
  private readonly cookies = inject(CookieConsentService);
  private readonly router = inject(Router);

  protected readonly configuring = signal(false);
  protected readonly trackingDraft = signal(false);

  private readonly urlPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    effect(() => {
      const requests = this.cookies.openRequests();
      if (requests > 0) {
        this.openConfig();
      }
    });
  }

  protected showBanner(): boolean {
    return this.cookies.needsDecision() && !this.configuring();
  }

  protected showReopen(): boolean {
    return !this.cookies.needsDecision() && !this.configuring();
  }

  /** Login y /legal ya exponen configurar cookies / contacto. */
  protected hideReopenFooter(): boolean {
    const url = this.urlPath().split('?')[0];
    return url === '/' || url.startsWith('/legal');
  }

  protected showPanel(): boolean {
    return this.configuring();
  }

  protected openConfig(): void {
    this.trackingDraft.set(this.cookies.preferences().tracking);
    this.configuring.set(true);
  }

  protected closeConfig(): void {
    this.configuring.set(false);
  }

  protected acceptAll(): void {
    this.cookies.acceptAll();
    this.configuring.set(false);
  }

  protected rejectAll(): void {
    this.cookies.rejectAll();
    this.configuring.set(false);
  }

  protected save(): void {
    this.cookies.save(this.trackingDraft());
    this.configuring.set(false);
  }

  protected onTrackingChange(event: MatSlideToggleChange): void {
    this.trackingDraft.set(event.checked);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.configuring()) {
      this.closeConfig();
    }
  }
}
