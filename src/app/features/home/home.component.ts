import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { Role } from '../../shared/models/role';
import { HomeAdminComponent } from './home-admin/home-admin.component';
import { HomeAuditorComponent } from './home-auditor/home-auditor.component';
import { HomeFuncionarioComponent } from './home-funcionario/home-funcionario.component';
import { HomeVecinoComponent } from './home-vecino/home-vecino.component';

/**
 * /inicio por rol (EP3-04, sección 7). accessGuard ya dejó fuera a quien no tiene exactamente un rol: sin rol
 * no se monta ningún bloque.
 */
@Component({
  selector: 'app-home',
  imports: [
    HomeAdminComponent,
    HomeAuditorComponent,
    HomeFuncionarioComponent,
    HomeVecinoComponent,
  ],
  template: `
    <main class="home">
      <header class="home__head">
        <h1>Inicio</h1>
        @if (accountName(); as name) {
          <p class="home__greeting">Hola, {{ name }}.</p>
        }
      </header>

      @switch (role()) {
        @case (Role.Vecino) {
          <app-home-vecino />
        }
        @case (Role.Funcionario) {
          <app-home-funcionario />
        }
        @case (Role.Admin) {
          <app-home-admin />
        }
        @case (Role.Auditor) {
          <app-home-auditor />
        }
      }
    </main>
  `,
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly catalogService = inject(CatalogService);

  protected readonly Role = Role;
  protected readonly role = this.auth.role;
  protected readonly accountName = computed(() => {
    const account = this.auth.account();
    return account?.name ?? account?.username ?? '';
  });

  constructor() {
    // En paralelo con los bloques y sin bloquearlos: mientras llega, las listas usan el nombre guardado. El
    // Auditor no lo necesita, porque la auditoría conserva el nombre que tenía el tipo en cada hecho.
    const role = this.role();
    if (role !== null && role !== Role.Auditor) {
      this.catalogService.loadLabels();
    }
  }
}
