import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../shared/models/role';

/** Destino temporal después del login. El dashboard real se desarrolla en EP2. */
@Component({
  selector: 'app-dashboard',
  imports: [MatButton],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly Role = Role;

  protected readonly accountName = computed(() => {
    const account = this.auth.account();
    return account?.name ?? account?.username ?? '';
  });

  /** Cada usuario de prueba tiene un solo rol; si tuviera varios se muestra el primero. */
  protected readonly primaryRole = computed(() => this.auth.roles()[0] ?? null);

  protected signOut(): void {
    this.auth.logout();
  }
}
