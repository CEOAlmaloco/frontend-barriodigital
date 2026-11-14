import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { CatalogService } from '../../../core/catalog/catalog.service';
import { ReportService } from '../../../core/report/report.service';
import { SlaBatch } from '../../../shared/models/report.model';
import { Request, RequestTransitions } from '../../../shared/models/request.model';
import { Role } from '../../../shared/models/role';
import { RequestLocationMapComponent } from '../request-location-map.component';
import { RequestActivity, RequestActivityEvent, RequestsService } from '../requests.service';
import { RequestDetailComponent } from './request-detail.component';

@Component({ selector: 'app-request-location-map', template: '<div class="map-stub"></div>' })
class MapStubComponent {
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly selectable = input(true);
  readonly label = input('');
}

const ME = 'oid-funcionario';

const TRANSITIONS: RequestTransitions = {
  INGRESADO: ['ADMITIDO', 'RECHAZADO'],
  ADMITIDO: ['EN_GESTION', 'RECHAZADO'],
  EN_GESTION: ['EN_TERRENO', 'RECHAZADO'],
  EN_TERRENO: ['RESUELTO', 'RECHAZADO'],
  RESUELTO: [],
  RECHAZADO: [],
  CANCELADO: [],
};

const base: Request = {
  id: 'req-1',
  folio: 'BD-2026-000123',
  procedureType: 'alumbrado',
  procedureLabel: 'Alumbrado público',
  description: 'La luminaria frente a la posta lleva cuatro noches apagada.',
  address: 'Camino Ralco–Pitril, km 3',
  sector: 'pitril',
  locationReference: 'Poste con cinta amarilla',
  status: 'INGRESADO',
  rejectionReason: null,
  createdAt: '2026-11-10T12:42:00.000Z',
  solicitanteId: 'oid-vecina',
  solicitanteNombre: 'María José Fuentes',
  solicitanteEmail: 'mj.fuentes@correo.cl',
  hasAssignee: false,
  assigneeId: null,
  assigneeName: null,
  slaBusinessDays: 5,
};

const assigned = (assigneeId = ME, assigneeName = 'Camila Huenchullán'): Request => ({
  ...base,
  status: 'ADMITIDO',
  hasAssignee: true,
  assigneeId,
  assigneeName,
});

const event = (overrides: Partial<RequestActivityEvent>): RequestActivityEvent => ({
  id: 'ev',
  occurredAt: '2026-11-10T12:42:00.000Z',
  kind: 'CREADO',
  visibility: 'PUBLICO',
  actorId: 'oid-vecina',
  actorName: 'María José Fuentes',
  actorRole: null,
  summary: 'Trámite ingresado',
  fromStatus: null,
  toStatus: 'INGRESADO',
  reason: null,
  channel: null,
  result: null,
  note: null,
  nextAttemptAt: null,
  ...overrides,
});

const activityOf = (eventos: RequestActivityEvent[]): RequestActivity => ({
  requestId: 'req-1',
  eventos,
  tiempos: {
    primeraAtencionSegundos: null,
    primeraAsignacionSegundos: null,
    gestionMunicipalSegundos: null,
    desdeElIngresoSegundos: 7200,
    totalResolucionSegundos: null,
    etapas: [
      { estado: 'INGRESADO', desde: '2026-11-10T12:42:00.000Z', hasta: null, segundos: 7200 },
    ],
    noCalculado: [],
  },
  contacto: null,
  limites: [],
});

/** Texto por nodo, como lo recorre un lector de pantalla: sin las ligaduras de los íconos. */
const words = (node: Node | null | undefined): string => {
  if (!node) return '';
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll('mat-icon').forEach((icon) => icon.remove());
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join(' ');
};

describe('RequestDetailComponent', () => {
  let fixture: ComponentFixture<RequestDetailComponent>;
  let element: HTMLElement;
  let overlay: HTMLElement;
  let service: {
    getRequest: ReturnType<typeof vi.fn>;
    getActividad: ReturnType<typeof vi.fn>;
    getTransitions: ReturnType<typeof vi.fn>;
    getAttachment: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
    changeStatus: ReturnType<typeof vi.fn>;
    registerGestion: ReturnType<typeof vi.fn>;
  };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  /** Nombres del catálogo: vacío equivale a un catálogo que no respondió. */
  const catalogLabels = signal<ReadonlyMap<string, string>>(new Map());
  const loadLabels = vi.fn();
  let reportService: { getSlaBatch: ReturnType<typeof vi.fn> };
  let getSlaBatch: () => Observable<SlaBatch>;
  const slaOf = (slaStatus: SlaBatch['items'][number]['slaStatus'], dueDate: string | null) => () =>
    of({ items: [{ requestId: 'req-1', slaStatus, dueDate }], lastEventAt: null });
  beforeEach(() => {
    getSlaBatch = slaOf('POR_VENCER', '2099-01-05');
  });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const render = async (
    role: Role,
    getRequest: () => Observable<Request> = () => of(base),
    activity: RequestActivity = activityOf([event({ id: 'creado' })]),
  ) => {
    service = {
      getRequest: vi.fn(getRequest),
      getActividad: vi.fn(() => of(activity)),
      getTransitions: vi.fn(() => of(TRANSITIONS)),
      getAttachment: vi.fn(() => of(new Blob(['png'], { type: 'image/png' }))),
      take: vi.fn(),
      changeStatus: vi.fn(),
      registerGestion: vi.fn(),
    };
    snackBar = { open: vi.fn() };
    reportService = { getSlaBatch: vi.fn(() => getSlaBatch()) };
    params = new BehaviorSubject(convertToParamMap({ id: 'req-1' }));
    const auth = { role: signal(role), hasRole: (value: Role) => value === role, userId: signal(ME) };

    TestBed.configureTestingModule({
      imports: [RequestDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: RequestsService, useValue: service },
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: CatalogService, useValue: { labels: catalogLabels, loadLabels } },
        { provide: ReportService, useValue: reportService },
      ],
    });
    TestBed.overrideComponent(RequestDetailComponent, {
      remove: { imports: [RequestLocationMapComponent] },
      add: { imports: [MapStubComponent] },
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(RequestDetailComponent);
    element = fixture.nativeElement;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await fixture.whenStable();
  };

  afterEach(() => {
    overlay?.replaceChildren();
    catalogLabels.set(new Map());
    loadLabels.mockClear();
  });

  /** Texto del bloque "Plazo de atención" del panel, sin el nombre del botón de ayuda. */
  const plazo = () => {
    const block = element.querySelector('.panel__facts')?.cloneNode(true) as Element | undefined;
    block?.querySelectorAll('app-info-toggletip').forEach((tip) => tip.remove());
    return words(block);
  };
  const openHelp = async () => {
    element.querySelector<HTMLButtonElement>('.panel__facts app-info-toggletip button')!.click();
    await fixture.whenStable();
    return overlay.querySelector('.toggletip__bubble')?.textContent ?? '';
  };

  describe('plazo de atención (EP3-53)', () => {
    it('el staff ve los días, el estado de report y el vencimiento, pedidos con el id de la ruta', async () => {
      await render(Role.Funcionario);
      expect(reportService.getSlaBatch).toHaveBeenCalledWith(['req-1']);
      expect(plazo()).toBe('Plazo de atención 5 días hábiles Por vencer Vence el 5 ene 2099');
      expect(await openHelp()).toContain(
        'Pasa a «Por vencer» cuando quedan 2 días hábiles o menos.',
      );
    });

    it('el Vecino ve la explicación del conteo, sin el umbral interno', async () => {
      await render(Role.Vecino);
      const help = await openHelp();
      expect(help).toContain('Se cuentan desde el día hábil siguiente al ingreso.');
      expect(help).not.toContain('Por vencer');
      // El dato del encabezado se mantiene para todos los roles
      expect(element.querySelector('.request-detail__meta')?.textContent).toContain(
        'Plazo de 5 días hábiles',
      );
    });

    it('un cerrado evaluado muestra la fecha comprometida', async () => {
      getSlaBatch = slaOf('CUMPLIDO', '2026-11-06');
      await render(Role.Auditor, () => of({ ...base, status: 'RESUELTO' }));
      expect(plazo()).toContain('Cumplido Plazo al 6 nov');
    });

    it('report caído: el trámite se muestra y solo el estado queda "No disponible", con su reintento', async () => {
      getSlaBatch = () => throwError(() => new HttpErrorResponse({ status: 503 }));
      await render(Role.Admin);
      expect(element.querySelector('h1')?.textContent).toContain('Alumbrado público');
      expect(plazo()).toContain('5 días hábiles');
      expect(plazo()).toContain('Estado no disponible');

      getSlaBatch = slaOf('VENCIDO', '2026-11-03');
      await click(button('Reintentar'));
      expect(reportService.getSlaBatch).toHaveBeenCalledTimes(2);
      expect(plazo()).toContain('Vencido');
    });

    it('un trámite que report no conoce muestra los días y "Sin información de estado"', async () => {
      getSlaBatch = slaOf(null, null);
      await render(Role.Funcionario);
      expect(plazo()).toBe('Plazo de atención 5 días hábiles Sin información de estado');
    });

    it('un tipo sin plazo no ofrece ayuda ni estado', async () => {
      getSlaBatch = slaOf('SIN_PLAZO', null);
      await render(Role.Funcionario, () => of({ ...base, slaBusinessDays: null }));
      expect(plazo()).toBe('Plazo de atención Sin plazo definido para este tipo');
      expect(element.querySelector('.panel__facts app-info-toggletip')).toBeNull();
    });
  });

  describe('nombre del tipo', () => {
    const title = () => element.querySelector('h1')?.textContent?.trim();

    it('pide el catálogo sin esperarlo y, al llegar, muestra el nombre actual de un tipo renombrado', async () => {
      await render(Role.Funcionario);
      expect(loadLabels).toHaveBeenCalledOnce();
      expect(title()).toBe('Alumbrado público');

      catalogLabels.set(new Map([['alumbrado', 'Luminaria apagada']]));
      await fixture.whenStable();
      expect(title()).toBe('Luminaria apagada');
    });

    it('un trámite antiguo sin nombre guardado toma el del catálogo y, sin catálogo, el código', async () => {
      await render(Role.Vecino, () => of({ ...base, procedureLabel: null }));
      expect(title()).toBe('alumbrado');

      catalogLabels.set(new Map([['alumbrado', 'Alumbrado público']]));
      await fixture.whenStable();
      expect(title()).toBe('Alumbrado público');
    });

    it('un tipo que el catálogo ya no tiene conserva el nombre guardado', async () => {
      catalogLabels.set(new Map([['bache', 'Bache en calzada']]));
      await render(Role.Funcionario);
      expect(title()).toBe('Alumbrado público');
    });
  });

  const text = () => element.textContent ?? '';
  const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('button')];
  const button = (label: string) => {
    const found = buttons().find((item) => item.textContent?.trim().includes(label));
    if (!found) {
      throw new Error(`No está el botón ${label}`);
    }
    return found;
  };
  const hasButton = (label: string) =>
    buttons().some((item) => item.textContent?.trim().includes(label));
  const dialogButton = (label: string) => {
    const found = [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
      item.textContent?.trim().includes(label),
    );
    if (!found) {
      throw new Error(`No está el botón ${label} en el diálogo`);
    }
    return found;
  };
  const type = async (textarea: HTMLTextAreaElement, value: string) => {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const click = async (target: HTMLElement) => {
    target.click();
    await fixture.whenStable();
  };
  const clickAndClose = async (target: HTMLElement) => {
    const dialogs = TestBed.inject(MatDialog).openDialogs;
    const closed = firstValueFrom(dialogs[dialogs.length - 1].afterClosed());
    target.click();
    await closed;
    await fixture.whenStable();
  };

  describe('estados de la página', () => {
    it('muestra la carga mientras espera el trámite', async () => {
      await render(Role.Vecino, () => new Observable<Request>());

      expect(element.querySelector('[role="status"]')?.textContent).toContain(
        'Cargando el trámite',
      );
    });

    it('un error ofrece reintentar y al reintentar muestra el trámite', async () => {
      let calls = 0;
      await render(Role.Vecino, () =>
        ++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 503 })) : of(base),
      );

      expect(text()).toContain('No pudimos cargar el trámite');
      await click(button('Reintentar'));

      expect(service.getRequest).toHaveBeenCalledTimes(2);
      expect(element.querySelector('h1')?.textContent).toContain('Alumbrado público');
    });

    it('el 404 muestra trámite no encontrado sin pedir el historial', async () => {
      await render(Role.Vecino, () => throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(text()).toContain('Trámite no encontrado');
      expect(service.getActividad).not.toHaveBeenCalled();
      expect(element.querySelector('a[href="/tramites"]')).not.toBeNull();
    });

    it.each([Role.Admin, Role.Auditor])('%s vuelve al listado de trámites', async (role) => {
      await render(role, () => throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(element.querySelector('a[href="/tramites"]')?.textContent).toContain('Trámites');
      expect(element.querySelector('a[href="/inicio"]')).toBeNull();
    });

    it('un fallo del historial no oculta el trámite y se reintenta por separado', async () => {
      await render(Role.Vecino);
      service.getActividad.mockReturnValueOnce(throwError(() => new Error('caído')));
      params.next(convertToParamMap({ id: 'req-2' }));
      await fixture.whenStable();

      expect(element.querySelector('h1')?.textContent).toContain('Alumbrado público');
      expect(text()).toContain('No se pudo cargar el historial');
      await click(button('Reintentar'));

      expect(text()).toContain('Trámite ingresado');
    });
  });

  describe('contenido', () => {
    it('muestra folio, tipo, estado, plazo, datos, mapa e imagen adjunta', async () => {
      await render(Role.Funcionario, () =>
        of({ ...base, latitude: -37.91, longitude: -71.3, hasAttachment: true }),
      );

      expect(text()).toContain('Folio BD-2026-000123');
      expect(element.querySelector('h1')?.textContent).toContain('Alumbrado público');
      expect(element.querySelector('app-request-status-badge')?.textContent).toContain('Ingresado');
      expect(text()).toContain('Plazo de 5 días hábiles');
      expect(text()).toContain('Pitril');
      expect(text()).toContain('Poste con cinta amarilla');
      expect(element.querySelector('.map-stub')).not.toBeNull();
      expect(element.querySelector('a[target="_blank"]')?.getAttribute('href')).toContain(
        'mlat=-37.91',
      );
      expect(service.getAttachment).toHaveBeenCalledWith('req-1');
      expect(element.querySelector('.request-detail__photo img')?.getAttribute('src')).toMatch(
        /^blob:/,
      );
    });

    it('usa singular con un día hábil y omite el plazo cuando no hay', async () => {
      await render(Role.Vecino, () => of({ ...base, slaBusinessDays: 1 }));
      expect(text()).toContain('Plazo de 1 día hábil');

      TestBed.resetTestingModule();
      await render(Role.Vecino, () => of({ ...base, slaBusinessDays: null }));
      expect(text()).not.toContain('Plazo');
    });

    it('muestra la fecha de ingreso legible y, al personal, cuánto lleva sin responsable', async () => {
      await render(Role.Funcionario, () =>
        of({ ...base, createdAt: new Date(2026, 10, 10, 9, 42).toISOString() }),
      );

      expect(text()).toContain('Ingresado el 10 nov 2026, 09:42');
      expect(element.querySelector('app-request-attention-panel')?.textContent).toMatch(
        /Ingresado hace \d+ días?/,
      );
    });

    it('el personal ve "Sin plazo definido" cuando el tipo no tiene plazo', async () => {
      await render(Role.Funcionario, () => of({ ...base, slaBusinessDays: null }));

      expect(text()).toContain('Sin plazo definido');
      expect(element.querySelector('.request-detail__meta')?.textContent).not.toContain('Plazo');
    });

    it('sin punto ni imagen no muestra la sección de ubicación y evidencia', async () => {
      await render(Role.Vecino);

      expect(element.querySelector('.map-stub')).toBeNull();
      expect(text()).not.toContain('Evidencia');
      expect(service.getAttachment).not.toHaveBeenCalled();
    });

    it('pone el folio en el título de la pestaña', async () => {
      await render(Role.Vecino);

      expect(document.title).toBe('BD-2026-000123 | BarrioDigital');
    });
  });

  describe('Vecino', () => {
    it('ve "En atención" sin el nombre del responsable, sin acciones ni datos internos', async () => {
      await render(
        Role.Vecino,
        () => of({ ...assigned(), assigneeName: 'Camila Huenchullán' }),
        activityOf([
          event({ id: 'creado' }),
          event({
            id: 'hito',
            kind: 'ASIGNACION',
            actorId: null,
            actorName: 'Municipalidad',
            summary: 'Tu solicitud fue asignada para su atención',
          }),
          event({
            id: 'estado',
            kind: 'ESTADO',
            actorId: null,
            actorName: null,
            summary: 'Pasó de Ingresado a Admitido',
            interventionReason: 'No debería verse',
          }),
        ]),
      );

      expect(text()).toContain('Estado de tu solicitud');
      expect(text()).toContain('En atención');
      expect(plazo()).toBe('Plazo de atención 5 días hábiles');
      expect(reportService.getSlaBatch).not.toHaveBeenCalled();
      expect(element.querySelector('app-sla-indicator')).toBeNull();
      expect(text()).not.toContain('Camila Huenchullán');
      expect(text()).not.toContain('Solicitante');
      expect(text()).not.toContain('No debería verse');
      expect(text()).not.toContain('Interno');
      expect(hasButton('Tomar trámite')).toBe(false);
      expect(hasButton('Registrar gestión')).toBe(false);
      expect(hasButton('Rechazar')).toBe(false);
      expect(element.querySelectorAll('.timeline__actor')[0]?.textContent).toBe('Municipalidad');
      expect(element.querySelector('.timeline__filters')).toBeNull();
      expect(service.getTransitions).not.toHaveBeenCalled();
    });

    it('ve el motivo de su trámite rechazado', async () => {
      await render(Role.Vecino, () =>
        of({ ...base, status: 'RECHAZADO', rejectionReason: 'Corresponde a la distribuidora.' }),
      );

      expect(text()).toContain('Motivo del rechazo');
      expect(text()).toContain('Corresponde a la distribuidora.');
    });
  });

  describe('Funcionario', () => {
    it('sin responsable: "Tomar trámite" es la única acción', async () => {
      await render(Role.Funcionario);

      expect(text()).toContain('Sin responsable');
      expect(hasButton('Tomar trámite')).toBe(true);
      expect(hasButton('Admitir')).toBe(false);
      expect(hasButton('Registrar gestión')).toBe(false);
      expect(hasButton('Rechazar')).toBe(false);
    });

    it('al tomar actualiza el trámite, el historial y muestra sus acciones', async () => {
      await render(Role.Funcionario);
      service.take.mockReturnValue(
        of({ ...base, hasAssignee: true, assigneeId: ME, assigneeName: 'Camila Huenchullán' }),
      );

      await click(button('Tomar trámite'));

      expect(service.take).toHaveBeenCalledWith('req-1');
      expect(service.getActividad).toHaveBeenCalledTimes(2);
      expect(snackBar.open).toHaveBeenCalledWith(
        'Tomaste el trámite. Ahora eres responsable.',
        undefined,
        expect.anything(),
      );
      expect(text()).toContain('Responsable · tú');
      expect(hasButton('Tomar trámite')).toBe(false);
      expect(hasButton('Admitir')).toBe(true);
      expect(hasButton('Registrar gestión')).toBe(true);
      expect(hasButton('Rechazar')).toBe(true);
    });

    it('si otra persona lo tomó antes, avisa y recarga el trámite', async () => {
      await render(Role.Funcionario);
      service.take.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: 'El tramite ya tiene responsable' },
            }),
        ),
      );
      service.getRequest.mockReturnValue(of(assigned('oid-otro', 'Luis Pérez')));

      await click(button('Tomar trámite'));

      expect(snackBar.open).toHaveBeenCalledWith(
        'Otra persona tomó este trámite. Actualizamos la información.',
        undefined,
        expect.anything(),
      );
      expect(service.getRequest).toHaveBeenCalledTimes(2);
      expect(text()).toContain('Solo Luis Pérez puede operar este trámite.');
    });

    it('que no es el responsable solo lee', async () => {
      await render(Role.Funcionario, () => of(assigned('oid-otro', 'Luis Pérez')));

      expect(text()).toContain('Luis Pérez');
      expect(text()).toContain('Solo Luis Pérez puede operar este trámite.');
      expect(hasButton('Tomar trámite')).toBe(false);
      expect(hasButton('Pasar a gestión')).toBe(false);
      expect(hasButton('Registrar gestión')).toBe(false);
      expect(service.getTransitions).not.toHaveBeenCalled();
    });

    it('responsable: cambia el estado sin motivo de intervención y refresca después', async () => {
      await render(Role.Funcionario, () => of(assigned()));
      service.changeStatus.mockReturnValue(of({ ...assigned(), status: 'EN_GESTION' }));

      await click(button('Pasar a gestión'));
      expect(overlay.textContent).not.toContain('Motivo de intervención');
      expect(
        [...overlay.querySelectorAll('app-request-status-badge')].map((badge) =>
          badge.textContent?.trim(),
        ),
      ).toEqual(['Admitido', 'En gestión']);
      await clickAndClose(dialogButton('Confirmar cambio'));

      expect(service.changeStatus).toHaveBeenCalledWith('req-1', { status: 'EN_GESTION' });
      expect(service.getActividad).toHaveBeenCalledTimes(2);
      expect(element.querySelector('app-request-status-badge')?.textContent).toContain(
        'En gestión',
      );
      expect(hasButton('Enviar a terreno')).toBe(true);
    });

    it('si lo reasignaron entretanto, el diálogo pide actualizar el trámite', async () => {
      await render(Role.Funcionario, () => of(assigned()));
      service.changeStatus.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: { message: 'Solo el responsable del tramite puede operarlo' },
            }),
        ),
      );
      service.getRequest.mockReturnValue(of(assigned('oid-otro', 'Luis Pérez')));

      await click(button('Pasar a gestión'));
      await click(dialogButton('Confirmar cambio'));
      expect(overlay.textContent).toContain(
        'Solo el responsable del trámite puede operarlo. Actualiza el trámite.',
      );
      await clickAndClose(dialogButton('Cerrar y actualizar'));

      expect(service.getRequest).toHaveBeenCalledTimes(2);
      expect(text()).toContain('Solo Luis Pérez puede operar este trámite.');
    });

    it('responsable: registra una gestión y el historial muestra la respuesta', async () => {
      await render(Role.Funcionario, () => of(assigned()));
      service.registerGestion.mockReturnValue(
        of(
          activityOf([
            event({ id: 'creado' }),
            event({
              id: 'gestion',
              kind: 'GESTION',
              visibility: 'INTERNO',
              summary: 'Llamada: No contesta',
              actorName: 'Camila Huenchullán',
              actorRole: 'Funcionario',
              channel: 'LLAMADA',
            }),
          ]),
        ),
      );

      await click(button('Registrar gestión'));
      expect(overlay.textContent).not.toContain('Motivo de intervención');
      await clickAndClose(dialogButton('Registrar'));

      expect(service.registerGestion).toHaveBeenCalledWith(
        'req-1',
        expect.not.objectContaining({ interventionReason: expect.anything() }),
      );
      expect(text()).toContain('Llamada: No contesta');
      expect(text()).toContain('Interno');
    });
  });

  describe('Admin', () => {
    it('opera con aviso y exige el motivo de intervención, distinto del de rechazo', async () => {
      await render(Role.Admin, () => of(assigned('oid-otro', 'Luis Pérez')));
      service.changeStatus.mockReturnValue(
        of({
          ...assigned('oid-otro', 'Luis Pérez'),
          status: 'RECHAZADO',
          rejectionReason: 'Duplicado',
        }),
      );

      expect(text()).toContain('Operas como administrador');
      expect(hasButton('Tomar trámite')).toBe(false);
      await click(button('Rechazar'));

      const fields = overlay.querySelectorAll<HTMLTextAreaElement>('textarea');
      expect(fields).toHaveLength(2);
      expect(overlay.textContent).toContain('Motivo del rechazo (lo verá el vecino)');
      expect(overlay.textContent).toContain('Motivo de intervención (obligatorio)');

      await type(fields[0], 'Duplicado');
      await click(dialogButton('Confirmar rechazo'));
      expect(service.changeStatus).not.toHaveBeenCalled();

      await type(fields[1], 'Responsable con licencia médica');
      await clickAndClose(dialogButton('Confirmar rechazo'));

      expect(service.changeStatus).toHaveBeenCalledWith('req-1', {
        status: 'RECHAZADO',
        rejectionReason: 'Duplicado',
        interventionReason: 'Responsable con licencia médica',
      });
      expect(text()).toContain('El trámite está cerrado');
    });

    it('la gestión del Admin también exige motivo de intervención', async () => {
      await render(Role.Admin, () => of(assigned('oid-otro', 'Luis Pérez')));
      service.registerGestion.mockReturnValue(of(activityOf([event({ id: 'creado' })])));

      await click(button('Registrar gestión'));
      await click(dialogButton('Registrar'));
      expect(service.registerGestion).not.toHaveBeenCalled();
      expect(overlay.textContent).toContain('Indica el motivo de intervención.');

      const textareas = overlay.querySelectorAll<HTMLTextAreaElement>('textarea');
      await type(textareas[textareas.length - 1], 'Vecino pidió respuesta urgente');
      await click(dialogButton('Registrar'));

      expect(service.registerGestion).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ interventionReason: 'Vecino pidió respuesta urgente' }),
      );
    });
  });

  describe('Auditor', () => {
    it('solo lee: sin acciones, sin correo del solicitante y con la intervención visible', async () => {
      await render(
        Role.Auditor,
        () => of({ ...assigned('oid-otro', 'Luis Pérez'), solicitanteEmail: null }),
        activityOf([
          event({ id: 'creado' }),
          event({
            id: 'estado',
            kind: 'ESTADO',
            actorName: 'Rodrigo Sandoval',
            actorRole: 'Admin',
            summary: 'Pasó de Ingresado a Admitido',
            interventionReason: 'Responsable con licencia',
          }),
        ]),
      );

      expect(text()).toContain('Solo lectura');
      expect(text()).toContain('Luis Pérez');
      expect(text()).toContain('No visible para auditoría');
      expect(text()).toContain('Responsable con licencia');
      expect(text()).not.toContain('Solo Luis Pérez puede operar');
      for (const label of ['Tomar trámite', 'Pasar a gestión', 'Registrar gestión', 'Rechazar']) {
        expect(hasButton(label)).toBe(false);
      }
      expect(service.getTransitions).not.toHaveBeenCalled();
    });
  });

  describe('enlace a auditoría (EP3-51)', () => {
    const auditLink = () =>
      [...element.querySelectorAll<HTMLAnchorElement>('a')].find((link) =>
        link.textContent?.includes('Ver en auditoría'),
      );

    it.each([Role.Admin, Role.Auditor])(
      '%s abre el historial del trámite por folio',
      async (role) => {
        await render(role);
        expect(auditLink()?.getAttribute('href')).toBe('/audit?view=timeline&folio=BD-2026-000123');
      },
    );

    it('un trámite sin folio enlaza por su id', async () => {
      await render(Role.Auditor, () => of({ ...base, folio: null }));
      expect(auditLink()?.getAttribute('href')).toBe('/audit?view=timeline&requestId=req-1');
    });

    it.each([Role.Funcionario, Role.Vecino])('%s no ve el enlace', async (role) => {
      await render(role);
      expect(auditLink()).toBeUndefined();
    });
  });

  describe('estados terminales', () => {
    it.each(['RESUELTO', 'RECHAZADO', 'CANCELADO'] as const)(
      '%s: el responsable no ve acciones y el avance queda cerrado',
      async (status) => {
        await render(Role.Funcionario, () => of({ ...assigned(), status }));

        expect(text()).toContain(
          'El trámite está cerrado y no admite cambios de estado ni gestiones.',
        );
        for (const label of ['Tomar trámite', 'Registrar gestión', 'Rechazar', 'Resolver']) {
          expect(hasButton(label)).toBe(false);
        }
        const current = element.querySelector('[aria-current="step"]');
        if (status === 'RESUELTO') {
          expect(current).toBeNull();
          expect(element.querySelectorAll('.progress__step--done')).toHaveLength(5);
        } else {
          expect(current?.textContent).toContain(
            status === 'RECHAZADO' ? 'Rechazado' : 'Cancelado',
          );
        }
      },
    );

    it('un trámite cerrado sin responsable no ofrece tomarlo', async () => {
      await render(Role.Funcionario, () => of({ ...base, status: 'RECHAZADO' }));

      expect(hasButton('Tomar trámite')).toBe(false);
      expect(element.querySelector('.request-detail__chip--accent')).toBeNull();
    });

    it('el Vecino ve su trámite cancelado', async () => {
      await render(Role.Vecino, () => of({ ...base, status: 'CANCELADO' }));

      expect(element.querySelector('app-request-status-badge')?.textContent).toContain('Cancelado');
      expect(text()).toContain('Cancelaste este trámite.');
    });
  });

  describe('asignación (EP3-47)', () => {
    const reassignButton = () =>
      element.querySelector<HTMLButtonElement>('[aria-label="Reasignar el trámite a otro funcionario"]');

    it('el Admin asigna un trámite sin responsable como acción principal', async () => {
      await render(Role.Admin);

      expect(hasButton('Asignar funcionario')).toBe(true);
      expect(hasButton('Tomar trámite')).toBe(false);
      expect(text()).toContain('El trámite no tiene responsable.');
      expect(reassignButton()).toBeNull();
    });

    it('el responsable y el Admin pueden reasignar; otro funcionario y el Auditor no', async () => {
      await render(Role.Funcionario, () => of(assigned()));
      expect(reassignButton()).not.toBeNull();

      TestBed.resetTestingModule();
      await render(Role.Admin, () => of(assigned('oid-otro', 'Luisa Painemal')));
      expect(reassignButton()).not.toBeNull();

      TestBed.resetTestingModule();
      await render(Role.Funcionario, () => of(assigned('oid-otro', 'Luisa Painemal')));
      expect(reassignButton()).toBeNull();

      TestBed.resetTestingModule();
      await render(Role.Auditor, () => of(assigned()));
      expect(reassignButton()).toBeNull();
    });

    it('un trámite cerrado no se reasigna', async () => {
      await render(Role.Admin, () => of({ ...assigned(), status: 'RESUELTO' }));

      expect(reassignButton()).toBeNull();
      expect(hasButton('Asignar funcionario')).toBe(false);
    });

    it('al guardar, actualiza el responsable y avisa', async () => {
      await render(Role.Admin);
      const saved = assigned('oid-luisa', 'Luisa Painemal');
      const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of({ kind: 'saved', request: saved, reassigned: false }),
      } as never);

      button('Asignar funcionario').click();
      await fixture.whenStable();

      expect(open).toHaveBeenCalledOnce();
      expect(snackBar.open).toHaveBeenCalledWith('Trámite asignado a Luisa Painemal.', undefined, {
        duration: 3500,
      });
      expect(text()).toContain('Luisa Painemal');
    });

    it('si el trámite cambió, recarga el detalle y explica por qué', async () => {
      await render(Role.Funcionario, () => of(assigned()));
      vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of({ kind: 'reload', message: 'El trámite ya está cerrado.' }),
      } as never);
      const calls = service.getRequest.mock.calls.length;

      reassignButton()!.click();
      await fixture.whenStable();

      expect(snackBar.open).toHaveBeenCalledWith('El trámite ya está cerrado.', undefined, {
        duration: 5000,
      });
      expect(service.getRequest).toHaveBeenCalledTimes(calls + 1);
    });
  });
});
