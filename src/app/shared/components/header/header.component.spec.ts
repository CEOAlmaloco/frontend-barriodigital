import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../models/role';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let element: HTMLElement;
  const logout = vi.fn();

  const render = async (userRoles: Role[]) => {
    const roles = signal<string[]>(userRoles);
    const auth = {
      account: signal({
        name: 'Usuario de prueba',
        username: 'usuario@cloudproyecto.onmicrosoft.com',
      }),
      roles,
      hasRole: (role: string) => roles().includes(role),
      logout,
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([
          { path: 'reports', children: [] },
          { path: 'audit', children: [] },
        ]),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HeaderComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
    return fixture;
  };

  const linkLabels = () =>
    Array.from(element.querySelectorAll('.header__link'), (link) => link.textContent?.trim());

  it.each([Role.Vecino, Role.Funcionario])('%s ve Inicio y Trámites', async (role) => {
    await render([role]);

    expect(linkLabels()).toEqual(['Inicio', 'Trámites']);
  });

  it('Admin ve Inicio, Administración y Reportes', async () => {
    await render([Role.Admin]);

    expect(linkLabels()).toEqual(['Inicio', 'Administración', 'Reportes']);
    expect(element.querySelector('a[href="/admin"]')).not.toBeNull();
    expect(element.querySelector('a[href="/reports"]')).not.toBeNull();
  });

  it('Auditor ve Inicio y Auditoría', async () => {
    await render([Role.Auditor]);

    expect(linkLabels()).toEqual(['Inicio', 'Auditoría']);
    expect(element.querySelector('a[href="/audit"]')).not.toBeNull();
  });

  it('Admin con Auditor conserva ambos grupos de navegación', async () => {
    await render([Role.Admin, Role.Auditor]);

    expect(linkLabels()).toEqual(['Inicio', 'Administración', 'Reportes', 'Auditoría']);
  });

  it('sin roles ve solo Inicio', async () => {
    await render([]);

    expect(linkLabels()).toEqual(['Inicio']);
  });

  it('muestra solo el nombre de la cuenta y cierra sesión desde el header', async () => {
    await render([Role.Vecino]);

    expect(element.querySelector('.header__account-name')?.textContent?.trim()).toBe(
      'Usuario de prueba',
    );

    element.querySelector<HTMLButtonElement>('.header__sign-out')?.click();
    expect(logout).toHaveBeenCalled();
  });

  it('el botón de menú abre la navegación y lo indica con aria-expanded', async () => {
    const fixture = await render([Role.Vecino]);
    const toggle = element.querySelector<HTMLButtonElement>('.header__menu-toggle');

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    await fixture.whenStable();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.header__nav--open')).not.toBeNull();
  });

  it.each([
    { label: 'Reportes', path: '/reports', role: Role.Admin },
    { label: 'Auditoría', path: '/audit', role: Role.Auditor },
  ])('navegar a $label cierra el menú móvil y marca el enlace activo', async ({ path, role }) => {
    const fixture = await render([role]);
    const toggle = element.querySelector<HTMLButtonElement>('.header__menu-toggle');
    const link = element.querySelector<HTMLAnchorElement>(`a[href="${path}"]`);

    toggle?.click();
    await fixture.whenStable();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    link?.click();
    await fixture.whenStable();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('.header__nav--open')).toBeNull();
    expect(link?.classList.contains('header__link--active')).toBe(true);
    expect(link?.getAttribute('aria-current')).toBe('page');
  });
});
