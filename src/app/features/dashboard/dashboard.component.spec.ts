import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../shared/models/role';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let element: HTMLElement;

  const render = async (userRoles: string[]) => {
    const roles = signal(userRoles);
    const auth = {
      account: signal({ name: 'Usuario de prueba', username: 'usuario@cloudproyecto.onmicrosoft.com' }),
      roles,
      hasRole: (role: string) => roles().includes(role),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const title = () => element.querySelector('h1')?.textContent ?? '';
  const text = () => element.textContent ?? '';

  it('Admin: da la bienvenida con su rol y muestra solo el panel de administración', async () => {
    await render([Role.Admin]);

    expect(title()).toContain('Bienvenido, Admin');
    expect(text()).toContain('Panel de administración');
    expect(text()).not.toContain('Mis trámites');
  });

  it('Vecino: da la bienvenida con su rol y muestra solo sus trámites', async () => {
    await render([Role.Vecino]);

    expect(title()).toContain('Bienvenido, Vecino');
    expect(text()).toContain('Mis trámites');
    expect(text()).not.toContain('Panel de administración');
  });

  it('sin roles muestra el título genérico y ningún bloque por rol', async () => {
    await render([]);

    expect(title()).toContain('Inicio');
    expect(text()).not.toContain('Panel de administración');
    expect(text()).not.toContain('Mis trámites');
  });
});
