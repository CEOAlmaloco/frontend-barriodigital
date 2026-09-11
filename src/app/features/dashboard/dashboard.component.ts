import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { AuthService } from '../../core/auth/auth.service';

/** Destino temporal después del login. El dashboard real se desarrolla en EP2. */
@Component({
  selector: 'app-dashboard',
  imports: [MatButton],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);

  protected readonly accountName = computed(() => {
    const account = this.auth.account();
    return account?.name ?? account?.username ?? '';
  });

  protected signOut(): void {
    this.auth.logout();
  }
}
