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
    description: 'Rama sobre el cable',
    procedureType: 'alumbrado',
    address: 'Calle 1',
    status: 'INGRESADO',
    createdAt: '2026-09-01T12:00:00.000Z',
    solicitanteId: 'vecino-actual',
  };
  const other: Request = {
    ...mine,
    id: 'ajeno',
    description: 'Bache de otro vecino',
    solicitanteId: 'otro-vecino',
  };

  let service: { getRequests: ReturnType<typeof vi.fn>; createRequest: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<RequestsComponent>;
  let element: HTMLElement;

  const render = async (role: Role, getRequests: () => Observable<Request[]> = () => of([mine, other])) => {
    service = { getRequests: vi.fn(getRequests), createRequest: vi.fn(() => of(mine)) };
    const auth = { hasRole: (userRole: string) => userRole === role };

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

  it('Vecino: ve el formulario, sin filtros, y lo que entrega el servidor sin volver a filtrarlo', async () => {
    await render(Role.Vecino);

    expect(element.querySelector('.requests__card')).not.toBeNull();
    expect(element.querySelector('#requests-list-title')?.textContent).toContain('Mis trámites');
    expect(element.querySelector('.requests__filters')).toBeNull();
    expect(service.getRequests).toHaveBeenCalledWith(undefined);
    expect(text()).toContain('Rama sobre el cable');
    expect(text()).toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha']);
  });

  it('Funcionario: sin formulario, con filtros, todos los trámites y sin columna Solicitante', async () => {
    await render(Role.Funcionario);

    expect(element.querySelector('.requests__card')).toBeNull();
    expect(element.querySelector('#requests-list-title')?.textContent).toContain('Todos los trámites');
    expect(element.querySelector('.requests__filters')).not.toBeNull();
    expect(text()).toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha']);
    expect(text()).not.toContain('otro-vecino');
  });

  it('Funcionario: pide el listado con los filtros elegidos', async () => {
    await render(Role.Funcionario);

    fixture.componentInstance['filters'].setValue({ status: 'RESUELTO', from: new Date(2026, 8, 1), to: null });
    await fixture.whenStable();

    expect(service.getRequests).toHaveBeenLastCalledWith({ status: 'RESUELTO', from: '2026-09-01' });
  });

  it('muestra la etiqueta del tipo y, si el código no está en la lista, el código crudo', async () => {
    await render(Role.Vecino, () => of([mine, { ...other, procedureType: 'desconocido' }]));

    expect(text()).toContain('Alumbrado público');
    expect(text()).toContain('desconocido');
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
    const payload = { procedureType: 'otro', description: 'Poste caído', address: 'Calle 2' };

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
