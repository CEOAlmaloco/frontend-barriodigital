import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { OVERSIGHT_ROLES, REQUESTS_ROLES, ROLE_LABELS, Role } from '../../models/role';

interface NavItem {
  label: string;
  path: string;
  /** Sin roles, el ítem es visible para cualquier usuario con un rol válido. */
  roles?: readonly Role[];
}

/** Mismos roles que data.roles de cada ruta en app.routes.ts. */
const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Inicio', path: '/inicio' },
  { label: 'Trámites', path: '/tramites', roles: REQUESTS_ROLES },
  { label: 'Administración', path: '/admin', roles: [Role.Admin] },
  { label: 'Reportes', path: '/reports', roles: OVERSIGHT_ROLES },
  { label: 'Mapa de trámites', path: '/reports/map', roles: [Role.Funcionario] },
  { label: 'Auditoría', path: '/audit', roles: OVERSIGHT_ROLES },
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

  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });

  /** El layout solo se monta con un rol válido (accessGuard); sin él no hay navegación. */
  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return role ? NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)) : [];
  });

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
