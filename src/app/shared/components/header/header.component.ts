import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { REQUESTS_ROLES, Role } from '../../models/role';

interface NavItem {
  label: string;
  path: string;
  /** Sin roles, el ítem es visible para cualquier usuario autenticado. */
  roles?: readonly Role[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', path: '/inicio' },
  { label: 'Trámites', path: '/tramites', roles: REQUESTS_ROLES },
];

@Component({
  selector: 'app-header',
  imports: [MatButton, MatIconButton, MatIcon, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);

  protected readonly isMenuOpen = signal(false);

  protected readonly accountName = computed(() => {
    const account = this.auth.account();
    return account?.name ?? account?.username ?? '';
  });

  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.roles || item.roles.some((role) => this.auth.hasRole(role))),
  );

  protected toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected signOut(): void {
    this.auth.logout();
  }
}
