import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccessibilityService } from '../../core/accessibility/accessibility.service';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../shared/models/role';
import { RequestsService } from '../requests/requests.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  const logout = vi.fn();
  const getNotificationPreferences = vi.fn(() => of({ emailEnabled: true }));
  const updateNotificationPreferences = vi.fn((emailEnabled: boolean) => of({ emailEnabled }));
  const getRequests = vi.fn(() =>
    of({
      content: [
        {
          id: 'req-1',
          description: 'Luminaria apagada',
          procedureType: 'alumbrado',
          procedureLabel: 'Alumbrado público',
          address: 'Calle 1',
          status: 'INGRESADO',
          rejectionReason: null,
          createdAt: '2026-11-13T12:00:00.000Z',
          solicitanteId: 'oid-ana',
          solicitanteNombre: 'Ana Soto',
          folio: 'BD-2026-000009',
        },
      ],
      page: 0,
      size: 5,
      totalElements: 1,
      totalPages: 1,
    }),
  );
  const snackBar = { open: vi.fn() };

  const render = async (role: Role = Role.Vecino) => {
    const roleSignal = signal<Role | null>(role);
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            account: signal({
              name: 'Ana Soto',
              username: 'ana.soto@municipio.cl',
              idTokenClaims: { auth_time: 1_763_280_000 },
            }),
            userId: signal('oid-ana'),
            role: roleSignal,
            logout,
          },
        },
        {
          provide: RequestsService,
          useValue: {
            getNotificationPreferences,
            updateNotificationPreferences,
            getRequests,
          },
        },
        { provide: MatSnackBar, useValue: snackBar },
        AccessibilityService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileComponent);
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(() => {
    localStorage.clear();
    logout.mockClear();
    getNotificationPreferences.mockClear();
    updateNotificationPreferences.mockClear();
    getRequests.mockClear();
    snackBar.open.mockClear();
    getNotificationPreferences.mockReturnValue(of({ emailEnabled: true }));
    updateNotificationPreferences.mockImplementation((emailEnabled: boolean) =>
      of({ emailEnabled }),
    );
    getRequests.mockReturnValue(
      of({
        content: [
          {
            id: 'req-1',
            description: 'Luminaria apagada',
            procedureType: 'alumbrado',
            procedureLabel: 'Alumbrado público',
            address: 'Calle 1',
            status: 'INGRESADO',
            rejectionReason: null,
            createdAt: '2026-11-13T12:00:00.000Z',
            solicitanteId: 'oid-ana',
            solicitanteNombre: 'Ana Soto',
            folio: 'BD-2026-000009',
          },
        ],
        page: 0,
        size: 5,
        totalElements: 1,
        totalPages: 1,
      }),
    );
  });

  it('muestra cuenta, foto editable y carga avisos', async () => {
    const fixture = await render(Role.Vecino);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Mi perfil');
    expect(element.querySelector('.profile__name')?.textContent?.trim()).toBe('Ana Soto');
    expect(element.textContent).toContain('Cuenta activa');
    expect(element.querySelector('.profile__avatar-edit')).toBeTruthy();
    expect(element.textContent).toContain('Cerrar sesión');
    expect(getNotificationPreferences).toHaveBeenCalled();
  });

  it('navega a notificaciones y guarda el interruptor de correo', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const notifBtn = Array.from(element.querySelectorAll<HTMLButtonElement>('.profile__nav-btn')).find(
      (button) => button.textContent?.includes('Notificaciones'),
    );
    notifBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('.profile__layout--detail')).toBeTruthy();
    const toggle = element.querySelector('mat-slide-toggle button') as HTMLButtonElement;
    toggle.click();
    await fixture.whenStable();

    expect(updateNotificationPreferences).toHaveBeenCalledWith(false);
    expect(snackBar.open).toHaveBeenCalledWith('Avisos por correo pausados.', 'Cerrar', {
      duration: 4000,
    });
  });

  it('muestra actividad reciente de trámites', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const activityBtn = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.profile__nav-btn'),
    ).find((button) => button.textContent?.includes('Mi actividad'));
    activityBtn?.click();
    await fixture.whenStable();

    expect(getRequests).toHaveBeenCalled();
    expect(element.textContent).toContain('Alumbrado público');
    expect(element.textContent).toContain('BD-2026-000009');
  });

  it('muestra preferencias de trabajo al Funcionario', async () => {
    const fixture = await render(Role.Funcionario);
    const element = fixture.nativeElement as HTMLElement;
    const workBtn = Array.from(element.querySelectorAll<HTMLButtonElement>('.profile__nav-btn')).find(
      (button) => button.textContent?.includes('Preferencias de trabajo'),
    );
    expect(workBtn).toBeTruthy();
    workBtn?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Preferencias de trabajo');
  });

  it('muestra error si la preferencia no carga', async () => {
    getNotificationPreferences.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    Array.from(element.querySelectorAll<HTMLButtonElement>('.profile__nav-btn'))
      .find((button) => button.textContent?.includes('Notificaciones'))
      ?.click();
    await fixture.whenStable();

    expect(element.textContent).toContain('El servicio de preferencias no responde');
  });

  it('cierra sesión desde la sección Sesión', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    Array.from(element.querySelectorAll<HTMLButtonElement>('.profile__nav-btn'))
      .find((button) => button.textContent?.includes('Sesión'))
      ?.click();
    await fixture.whenStable();
    Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Cerrar sesión'))
      ?.click();
    expect(logout).toHaveBeenCalled();
  });
});
