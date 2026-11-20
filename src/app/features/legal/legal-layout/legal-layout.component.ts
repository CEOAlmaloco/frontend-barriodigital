import { ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { SITE_INFO_PAGES } from '../../../shared/models/site-info-pages';

/** Contenedor público de las páginas de información: se ve igual con o sin sesión. */
@Component({
  selector: 'app-legal-layout',
  imports: [
    BrandLogoComponent,
    MatButton,
    MatIcon,
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './legal-layout.component.html',
  styleUrl: './legal-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalLayoutComponent {
  protected readonly isAuthenticated = inject(AuthService).isAuthenticated;
  protected readonly pages = SITE_INFO_PAGES;

  constructor() {
    const scroller = inject(ViewportScroller);
    // Al cambiar de documento se empieza a leer desde arriba; un ancla (#seccion) se maneja en la página
    inject(Router)
      .events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter((event) => !event.urlAfterRedirects.includes('#')),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => scroller.scrollToPosition([0, 0]));
  }
}
