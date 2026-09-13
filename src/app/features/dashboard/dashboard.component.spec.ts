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
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const text = () => element.textContent ?? '';

  it('titula la página Inicio y saluda con el nombre de la cuenta, sin cerrar sesión propio', async () => {
    await render([Role.Vecino]);

    expect(element.querySelector('h1')?.textContent).toContain('Inicio');
    expect(text()).toContain('Hola, Usuario de prueba.');
    expect(text()).not.toContain('Cerrar sesión');
  });

  it('Admin ve solo el panel de administración', async () => {
    await render([Role.Admin]);

    expect(text()).toContain('Panel de administración');
    expect(text()).not.toContain('Mis trámites');
  });

  it('Vecino ve solo sus trámites', async () => {
    await render([Role.Vecino]);

    expect(text()).toContain('Mis trámites');
    expect(text()).not.toContain('Panel de administración');
  });

  it('sin roles no muestra bloques por rol', async () => {
    await render([]);

    expect(text()).not.toContain('Panel de administración');
    expect(text()).not.toContain('Mis trámites');
  });
});
