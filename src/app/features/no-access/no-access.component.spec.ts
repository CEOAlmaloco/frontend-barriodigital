import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Role, RoleAccess } from '../../shared/models/role';
import { NoAccessComponent } from './no-access.component';

describe('NoAccessComponent', () => {
  let access: WritableSignal<RoleAccess | null>;
  let retry$: Subject<RoleAccess>;
  let auth: {
    access: WritableSignal<RoleAccess | null>;
    account: WritableSignal<{ name?: string; username: string } | null>;
    retryAccess: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<NoAccessComponent>;
  let element: HTMLElement;
  let router: Router;

  const render = async (initial: RoleAccess) => {
    access = signal<RoleAccess | null>(initial);
    retry$ = new Subject<RoleAccess>();
    auth = {
      access,
      account: signal({ name: 'Ana Pérez', username: 'ana.perez@cloudproyecto.onmicrosoft.com' }),
      retryAccess: vi.fn(() => retry$),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NoAccessComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(NoAccessComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';
  const buttons = () =>
    Array.from(element.querySelectorAll('button'), (button) => button.textContent?.trim());
  const button = (label: string) =>
    Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    ) as HTMLButtonElement;
  const supportLink = () => element.querySelector<HTMLAnchorElement>('.no-access__link');

  it('sin rol explica el motivo y ofrece ingresar con otra cuenta', async () => {
    await render({ kind: 'none' });

    expect(element.querySelector('h1')?.textContent).toBe('No puedes ingresar a BarrioDigital');
    expect(element.querySelector('main')?.getAttribute('aria-labelledby')).toBe('no-access-title');
    expect(text()).toContain('Tu cuenta no tiene un rol asignado en BarrioDigital.');
    expect(buttons()).toEqual(['Ingresar con otra cuenta']);

    button('Ingresar con otra cuenta').click();
    expect(auth.logout).toHaveBeenCalled();
  });

  it.each([
    { roles: [Role.Admin, Role.Funcionario], expected: 'Administrador y Funcionario' },
    {
      roles: [Role.Admin, Role.Vecino, Role.Auditor],
      expected: 'Administrador, Vecino y Auditor',
    },
  ])('con más de un rol nombra los roles $expected', async ({ roles, expected }) => {
    await render({ kind: 'multiple', roles });

    expect(element.querySelector('strong')?.textContent).toBe(expected);
    expect(text()).toContain('Cada cuenta debe tener solo uno.');
  });

  it('muestra la cuenta con la que se inició sesión', async () => {
    await render({ kind: 'none' });

    expect(element.querySelector('.no-access__account dt')?.textContent).toBe(
      'Sesión iniciada como',
    );
    expect(text()).toContain('Ana Pérez');
    expect(text()).toContain('ana.perez@cloudproyecto.onmicrosoft.com');
  });

  it('el enlace a soporte lleva el motivo y la cuenta', async () => {
    await render({ kind: 'multiple', roles: [Role.Admin, Role.Auditor] });

    const href = decodeURIComponent(supportLink()?.getAttribute('href') ?? '');
    expect(href).toContain('subject=Cuenta con más de un rol en BarrioDigital');
    expect(href).toContain('body=Cuenta: ana.perez@cloudproyecto.onmicrosoft.com');
  });

  describe('token sin leer', () => {
    beforeEach(async () => {
      await render({ kind: 'unavailable' });
    });

    it('no culpa a la cuenta y ofrece reintentar', () => {
      expect(element.querySelector('h1')?.textContent).toBe('No pudimos verificar tus permisos');
      expect(text()).not.toContain('no tiene un rol');
      expect(buttons()).toEqual(['Reintentar', 'Cerrar sesión']);
    });

    it('mientras reintenta conserva el motivo, bloquea el botón y lo anuncia', async () => {
      button('Reintentar').click();
      access.set(null);
      await fixture.whenStable();

      expect(auth.retryAccess).toHaveBeenCalledTimes(1);
      expect(element.querySelector('h1')?.textContent).toBe('No pudimos verificar tus permisos');
      expect(button('Reintentar').disabled).toBe(true);
      expect(button('Reintentar').getAttribute('aria-busy')).toBe('true');
      expect(element.querySelector('mat-progress-spinner')).not.toBeNull();
      expect(element.querySelector('[aria-live="polite"]')?.textContent).toContain(
        'Verificando tus permisos.',
      );

      button('Reintentar').click();
      expect(auth.retryAccess).toHaveBeenCalledTimes(1);
    });

    it('si vuelve a fallar lo informa y permite intentar otra vez', async () => {
      button('Reintentar').click();
      access.set({ kind: 'unavailable' });
      retry$.next({ kind: 'unavailable' });
      await fixture.whenStable();

      expect(element.querySelector('.no-access__error')?.textContent).toContain(
        'Todavía no pudimos verificar tus permisos.',
      );
      expect(button('Reintentar').disabled).toBe(false);
    });

    it('si el token ahora trae un solo rol lleva al inicio', async () => {
      button('Reintentar').click();
      access.set({ kind: 'granted', role: Role.Auditor });
      retry$.next({ kind: 'granted', role: Role.Auditor });
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/inicio', { replaceUrl: true });
    });

    it('si el token ahora muestra que no hay rol, cambia al motivo real', async () => {
      button('Reintentar').click();
      access.set({ kind: 'none' });
      retry$.next({ kind: 'none' });
      await fixture.whenStable();

      expect(text()).toContain('Tu cuenta no tiene un rol asignado en BarrioDigital.');
      expect(element.querySelector('.no-access__error')).toBeNull();
    });
  });
});
