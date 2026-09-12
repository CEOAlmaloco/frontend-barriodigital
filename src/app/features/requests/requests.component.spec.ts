import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Request } from '../../shared/models/request.model';
import { Role } from '../../shared/models/role';
import { RequestsComponent } from './requests.component';
import { RequestsService } from './requests.service';

describe('RequestsComponent', () => {
  const mine: Request = {
    id: 'propio',
    tipo: 'Poda de árbol',
    descripcion: 'Rama sobre el cable',
    direccion: 'Calle 1',
    estado: 'INGRESADO',
    fechaCreacion: '2026-09-01T12:00:00.000Z',
    solicitanteId: 'vecino-actual',
    solicitanteNombre: 'Vecino Test',
  };
  const other: Request = {
    ...mine,
    id: 'ajeno',
    descripcion: 'Bache de otro vecino',
    solicitanteId: 'otro-vecino',
    solicitanteNombre: 'María Pérez',
  };

  let service: { getRequests: ReturnType<typeof vi.fn>; createRequest: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<RequestsComponent>;
  let element: HTMLElement;

  const render = async (role: Role, getRequests: () => Observable<Request[]> = () => of([mine, other])) => {
    service = { getRequests: vi.fn(getRequests), createRequest: vi.fn(() => of(mine)) };
    const auth = { hasRole: (userRole: string) => userRole === role, userId: signal('vecino-actual') };

    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
      providers: [
        { provide: RequestsService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const text = () => element.textContent ?? '';
  const headers = () => Array.from(element.querySelectorAll('th'), (header) => header.textContent?.trim());
  const submitButton = () => element.querySelector<HTMLButtonElement>('.requests__submit');

  it('Vecino: ve el formulario, sin filtros, y solo sus trámites', async () => {
    await render(Role.Vecino);

    expect(element.querySelector('.requests__card')).not.toBeNull();
    expect(element.querySelector('#requests-list-title')?.textContent).toContain('Mis trámites');
    expect(element.querySelector('.requests__filters')).toBeNull();
    expect(text()).toContain('Rama sobre el cable');
    expect(text()).not.toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha']);
  });

  it('Funcionario: sin formulario, con filtros, todos los trámites y la columna Solicitante', async () => {
    await render(Role.Funcionario);

    expect(element.querySelector('.requests__card')).toBeNull();
    expect(element.querySelector('#requests-list-title')?.textContent).toContain('Todos los trámites');
    expect(element.querySelector('.requests__filters')).not.toBeNull();
    expect(text()).toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha', 'Solicitante']);
    expect(text()).toContain('María Pérez');
    expect(text()).not.toContain('otro-vecino');
  });

  it('no envía el formulario vacío y muestra el error de cada campo obligatorio', async () => {
    await render(Role.Vecino);

    submitButton()?.click();
    await fixture.whenStable();

    expect(service.createRequest).not.toHaveBeenCalled();
    expect(element.querySelectorAll('mat-error').length).toBe(3);
  });

  it('crea el trámite, avisa con un snackbar y recarga el listado', async () => {
    await render(Role.Vecino);
    const openSnackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const payload = { tipo: 'Otro', descripcion: 'Poste caído', direccion: 'Calle 2' };

    fixture.componentInstance['createForm'].setValue(payload);
    submitButton()?.click();
    await fixture.whenStable();

    expect(service.createRequest).toHaveBeenCalledWith(payload);
    expect(openSnackBar).toHaveBeenCalledWith('Trámite ingresado.', undefined, { duration: 3000 });
    expect(service.getRequests).toHaveBeenCalledTimes(2);
  });

  it('si falla la carga ofrece Reintentar y vuelve a pedir el listado', async () => {
    let attempts = 0;
    await render(Role.Vecino, () => (attempts++ === 0 ? throwError(() => new Error('sin red')) : of([])));

    expect(text()).toContain('No se pudieron cargar los trámites.');

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Reintentar'))
      ?.click();
    await fixture.whenStable();

    expect(service.getRequests).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Aún no has ingresado trámites.');
  });
});
