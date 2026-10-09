import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
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
    expect(text()).toContain('Rol: Vecino');
    expect(text()).not.toContain('Cerrar sesión');
  });

  it('Admin ve el catálogo y el cambio de estado, no la pantalla del vecino', async () => {
    await render([Role.Admin]);

    expect(text()).toContain('Panel de administración');
    expect(text()).toContain('Catálogo');
    expect(text()).toContain('Bache en calle');
    expect(text()).toContain('Cambio de estado');
    expect(text()).toContain('Ingresado');
    expect(text()).not.toContain('Mis trámites');
    expect(text()).not.toContain('Cola de admisión');
    expect(element.querySelector('a[href="/tramites"]')).toBeNull();
  });

  it('Vecino ve solo sus trámites', async () => {
    await render([Role.Vecino]);

    expect(text()).toContain('Mis trámites');
    expect(element.querySelector('a[href="/tramites"]')?.textContent).toContain('Ver mis trámites');
    expect(text()).not.toContain('Catálogo');
    expect(text()).not.toContain('Cambio de estado');
    expect(text()).not.toContain('Panel de administración');
  });

  it('Funcionario ve la cola y no el catálogo', async () => {
    await render([Role.Funcionario]);

    expect(text()).toContain('Cola de admisión');
    expect(element.querySelector('a[href="/tramites"]')?.textContent).toContain('Revisar la cola');
    expect(text()).not.toContain('Catálogo');
    expect(text()).not.toContain('Cambio de estado');
  });

  it('Auditor no ingresa trámites ni edita el catálogo', async () => {
    await render([Role.Auditor]);

    expect(text()).toContain('Auditoría');
    expect(text()).not.toContain('Catálogo');
    expect(text()).not.toContain('Mis trámites');
    expect(element.querySelector('a[href="/tramites"]')).toBeNull();
  });

  it('sin roles no muestra bloques por rol', async () => {
    await render([]);

    expect(text()).not.toContain('Rol:');
    expect(text()).not.toContain('Panel de administración');
    expect(text()).not.toContain('Mis trámites');
    expect(text()).not.toContain('Cola de admisión');
    expect(text()).not.toContain('Auditoría');
  });
});
