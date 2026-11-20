import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SITE_INFO_PAGES } from '../../models/site-info-pages';

/** Pie de todas las pantallas, con o sin sesión: información pública y contacto de soporte. */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooterComponent {
  protected readonly pages = SITE_INFO_PAGES;
  protected readonly supportEmail = environment.supportEmail;
}
