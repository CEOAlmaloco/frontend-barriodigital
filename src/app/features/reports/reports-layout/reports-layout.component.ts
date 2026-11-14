import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { OVERSIGHT_ROLES } from '../../../shared/models/role';

/**
 * Marco de reportería. El Admin y el Auditor navegan entre Indicadores y el mapa; el Funcionario solo tiene el
 * mapa (EP3-04, sección 2), así que no ve pestañas y el título nombra el mapa.
 */
@Component({
  selector: 'app-reports-layout',
  imports: [MatIcon, MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="reports-layout">
      <header class="reports-layout__head">
        <h1>{{ oversight() ? 'Reportes' : 'Mapa de trámites' }}</h1>
        <p class="reports-layout__lead">
          {{
            oversight()
              ? 'Indicadores y ubicación de los trámites de la comuna.'
              : 'Ubicación de los trámites de la comuna para organizar el trabajo en terreno.'
          }}
        </p>
      </header>

      @if (oversight()) {
        <nav
          mat-tab-nav-bar
          class="reports-layout__tabs"
          aria-label="Secciones de reportes"
          mat-stretch-tabs="false"
          [tabPanel]="panel"
        >
          <a
            mat-tab-link
            routerLink="/reports"
            routerLinkActive
            #indicators="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: true }"
            [active]="indicators.isActive"
          >
            <mat-icon aria-hidden="true">insights</mat-icon>
            Indicadores
          </a>
          <a
            mat-tab-link
            routerLink="/reports/map"
            routerLinkActive
            #map="routerLinkActive"
            [active]="map.isActive"
          >
            <mat-icon aria-hidden="true">map</mat-icon>
            Mapa de trámites
          </a>
        </nav>
        <mat-tab-nav-panel #panel class="reports-layout__panel">
          <router-outlet />
        </mat-tab-nav-panel>
      } @else {
        <div class="reports-layout__panel">
          <router-outlet />
        </div>
      }
    </main>
  `,
  styleUrl: './reports-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsLayoutComponent {
  private readonly auth = inject(AuthService);

  protected readonly oversight = computed(() => {
    const role = this.auth.role();
    return role !== null && OVERSIGHT_ROLES.includes(role);
  });
}
