import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../models/role';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let element: HTMLElement;
  const logout = vi.fn();

  const render = async (userRole: Role | null) => {
    const role = signal<Role | null>(userRole);
    const auth = {
      account: signal({
        name: 'Usuario de prueba',
        username: 'usuario@cloudproyecto.onmicrosoft.com',
      }),
      role,
      hasRole: (value: Role) => role() === value,
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

  it.each([
    { role: Role.Vecino, links: ['Inicio', 'Trámites'] },
    { role: Role.Funcionario, links: ['Inicio', 'Trámites'] },
    {
      role: Role.Admin,
      links: ['Inicio', 'Trámites', 'Administración', 'Reportes', 'Auditoría'],
    },
    { role: Role.Auditor, links: ['Inicio', 'Trámites', 'Reportes', 'Auditoría'] },
  ])('$role ve la navegación de su rol', async ({ role, links }) => {
    await render(role);

    expect(linkLabels()).toEqual(links);
  });

  it('el Auditor no ve Administración', async () => {
    await render(Role.Auditor);

    expect(element.querySelector('a[href="/admin"]')).toBeNull();
    expect(element.querySelector('a[href="/reports"]')).not.toBeNull();
    expect(element.querySelector('a[href="/audit"]')).not.toBeNull();
  });

  it('sin un rol válido no ofrece navegación', async () => {
    await render(null);

    expect(linkLabels()).toEqual([]);
    expect(element.querySelector('.header__account-role')).toBeNull();
  });

  it.each([
    { role: Role.Admin, label: 'Administrador' },
    { role: Role.Auditor, label: 'Auditor' },
  ])('identifica el rol $role junto al nombre', async ({ role, label }) => {
    await render(role);

    expect(element.querySelector('.header__account-role')?.textContent?.trim()).toBe(
      `Rol: ${label}`,
    );
  });

  it('muestra el nombre de la cuenta y cierra sesión desde el header', async () => {
    await render(Role.Vecino);

    expect(element.querySelector('.header__account-name')?.textContent?.trim()).toBe(
      'Usuario de prueba',
    );

    element.querySelector<HTMLButtonElement>('.header__sign-out')?.click();
    expect(logout).toHaveBeenCalled();
  });

  it('el botón de menú abre la navegación y lo indica con aria-expanded', async () => {
    const fixture = await render(Role.Vecino);
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
    const fixture = await render(role);
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
