import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Mock } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';

interface AuthServiceStub {
  isInteractionInProgress: WritableSignal<boolean>;
  loginFailed: WritableSignal<boolean>;
  isAuthenticated: WritableSignal<boolean>;
  login: Mock;
}

describe('LoginComponent', () => {
  let auth: AuthServiceStub;
  let fixture: ComponentFixture<LoginComponent>;
  let element: HTMLElement;
  let router: Router;

  const button = () => element.querySelector('button') as HTMLButtonElement;

  beforeEach(async () => {
    auth = {
      isInteractionInProgress: signal(false),
      loginFailed: signal(false),
      isAuthenticated: signal(false),
      login: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('en estado inicial muestra solo el botón habilitado, sin spinner ni error', () => {
    expect(element.querySelector('h1')?.textContent).toContain('BarrioDigital');
    expect(button().disabled).toBe(false);
    expect(element.querySelector('mat-progress-spinner')).toBeNull();
    expect(element.querySelector('.login__error')).toBeNull();
  });

  it('inicia sesión al presionar el botón', () => {
    button().click();

    expect(auth.login).toHaveBeenCalledTimes(1);
  });

  it('mientras carga deshabilita el botón y muestra el spinner sin cambiar el texto', async () => {
    auth.isInteractionInProgress.set(true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().querySelector('mat-progress-spinner')).not.toBeNull();
    expect(button().textContent).toContain('Iniciar sesión con Microsoft');
  });

  it('anuncia el error dentro de una región aria-live', async () => {
    auth.loginFailed.set(true);
    await fixture.whenStable();

    const liveRegion = element.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toContain('No se pudo iniciar sesión. Intenta nuevamente.');
  });

  it('redirige al inicio cuando hay sesión activa', async () => {
    auth.isAuthenticated.set(true);
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/inicio', { replaceUrl: true });
  });
});
