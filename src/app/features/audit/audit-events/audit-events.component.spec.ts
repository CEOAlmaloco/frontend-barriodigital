import { BreakpointObserver } from '@angular/cdk/layout';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of } from 'rxjs';

import { AuditService } from '../../../core/audit/audit.service';
import { AuditEvent } from '../../../shared/models/audit.model';
import { Page } from '../../../shared/models/page.model';
import { chileDateKey, chileDayStart, shiftDateKey } from '../audit-time';
import { AuditEventsComponent } from './audit-events.component';

@Component({ template: '' })
class OtherComponent {}

interface Call {
  params: Record<string, string>;
  subject: Subject<Page<AuditEvent>>;
}

const admin = { id: 'a1', name: 'Carolina Muñoz', role: 'Admin', sourceIp: '190.161.34.12' };

const configEvent: AuditEvent = {
  eventId: 'e-config',
  eventType: 'procedure-type.updated',
  occurredAt: '2026-11-13T19:42:08Z',
  producer: 'catalog',
  actor: admin,
  resourceType: 'procedure-type',
  resourceId: 'bache',
  requestId: null,
  folio: null,
  sequence: null,
  summary: 'Edicion del tipo de tramite bache',
  details: {
    before: { label: 'Bache en calle', dailyQuota: 20 },
    after: { label: 'Bache en calle', dailyQuota: 15 },
  },
};

const requestEvent: AuditEvent = {
  eventId: 'e-request',
  eventType: 'request.status-changed',
  occurredAt: '2026-11-13T19:20:51Z',
  producer: 'requests',
  actor: { id: 'f1', name: 'Javier Antilef', role: 'Funcionario', sourceIp: null },
  resourceType: 'request',
  resourceId: 'r1',
  requestId: 'r1',
  folio: 'BD-2026-000412',
  sequence: 2187,
  summary: 'Cambio de estado de INGRESADO a ADMITIDO',
  details: { fromStatus: 'INGRESADO', toStatus: 'ADMITIDO', interventionReason: null },
};

const purgeWithoutIp: AuditEvent = {
  ...configEvent,
  eventId: 'e-purge',
  eventType: 'queue.purged',
  resourceType: 'queue',
  resourceId: 'barrio.email.dlq',
  actor: { ...admin, sourceIp: null },
  details: { before: { messages: 12 }, after: { messagesRemoved: 12 } },
};

const pageOf = (
  content: AuditEvent[],
  overrides: Partial<Page<AuditEvent>> = {},
): Page<AuditEvent> => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  ...overrides,
});

describe('AuditEventsComponent', () => {
  let harness: RouterTestingHarness;
  let calls: Call[];
  let wide: boolean;

  const element = () => harness.routeNativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ').trim();
  const url = () => TestBed.inject(Router).url;
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  const respond = async (call: Call | undefined, page: Page<AuditEvent>) => {
    call!.subject.next(page);
    call!.subject.complete();
    await settle();
  };
  const fail = async (call: Call | undefined, status: number) => {
    call!.subject.error(new HttpErrorResponse({ status }));
    await settle();
  };
  const button = (label: string) => {
    const found = [...element().querySelectorAll<HTMLButtonElement>('button')].find(
      (item) =>
        item.textContent?.replace(/\s+/g, ' ').trim().includes(label) ||
        item.getAttribute('aria-label')?.includes(label),
    );
    if (!found) throw new Error(`No está el botón ${label}`);
    return found;
  };
  const click = async (target: HTMLElement) => {
    target.click();
    await settle();
  };
  /** Los selectores de fecha se completan por el formulario: jsdom no abre el calendario. */
  const form = () =>
    (harness.routeDebugElement!.componentInstance as unknown as { form: FormGroup }).form;

  async function open(path = '/audit', isWide = true) {
    calls = [];
    wide = isWide;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'audit', component: AuditEventsComponent },
          { path: 'tramites/:id', component: OtherComponent },
        ]),
        {
          provide: AuditService,
          useValue: {
            searchEvents: (params: Record<string, string>) => {
              const subject = new Subject<Page<AuditEvent>>();
              calls.push({ params, subject });
              return subject;
            },
          },
        },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: wide, breakpoints: {} }) },
        },
      ],
    });
    harness = await RouterTestingHarness.create(path);
    await settle();
  }

  it('abre con los últimos 7 días como filtro visible y eliminable', async () => {
    await open();
    const expectedFrom = chileDayStart(shiftDateKey(chileDateKey(new Date()), -6)).toISOString();
    expect(calls.length).toBe(1);
    expect(calls[0].params).toEqual({ from: expectedFrom, page: '0', size: '20' });
    expect(text()).toContain('Últimos 7 días');

    await click(button('Quitar el período'));

    expect(url()).toBe('/audit?period=all');
    expect(calls.length).toBe(2);
    expect(calls[1].params['from']).toBeUndefined();
    expect(text()).not.toContain('Últimos 7 días');
  });

  it('lista los eventos con su IP, o por qué no la tienen, sin textos de orden ni zona', async () => {
    await open();
    await respond(calls[0], pageOf([configEvent, requestEvent, purgeWithoutIp]));

    expect(element().querySelectorAll('tr.results__row').length).toBe(3);
    expect(text()).toContain('3 eventos');
    expect(text()).toContain('Edición del tipo de trámite');
    expect(text()).toContain('190.161.34.12');
    expect(text()).toContain('No aplica');
    expect(text()).toContain('No registrada');
    expect(text()).toContain('Folio BD-2026-000412');
    expect(text()).toContain('13/11/2026');
    expect(text()).toContain('16:42:08');
    expect(text()).not.toContain('Hora de Chile');
    expect(text()).not.toContain('Más recientes primero');
    expect(text()).not.toContain('Solo lectura');
  });

  it('despliega antes y después de una configuración y sus datos originales', async () => {
    await open();
    await respond(calls[0], pageOf([configEvent]));

    const expand = button('Detalle de Edición del tipo de trámite');
    await click(expand);

    expect(expand.getAttribute('aria-expanded')).toBe('true');
    const detail = element().querySelector('#audit-detail-e-config')!;
    expect(detail.textContent).toContain('Cambios');
    expect(detail.querySelector('.change__row--changed')?.textContent).toContain('Cupo diario');
    expect(detail.textContent).toContain('Datos originales');
    expect(detail.querySelector('pre')?.textContent).toContain('"eventId": "e-config"');
    expect(detail.querySelector('pre')?.textContent).toContain('"dailyQuota": 15');
  });

  it('descarta la respuesta de una búsqueda anterior que llega después de la nueva', async () => {
    await open();
    await harness.navigateByUrl('/audit?actorRole=Admin');
    await settle();

    expect(calls.length).toBe(2);
    expect(calls[1].params['actorRole']).toBe('Admin');
    expect(calls[0].subject.observed).toBe(false);

    await respond(calls[1], pageOf([configEvent]));
    calls[0].subject.next(pageOf([requestEvent, purgeWithoutIp]));
    await settle();

    expect(text()).toContain('1 evento');
    expect(element().querySelector('[role="status"]')?.textContent).toBe('1 evento encontrado.');
    expect(text()).toContain('Edición del tipo de trámite');
    expect(text()).not.toContain('Purga de la cola');
  });

  it('filtra por el actor de un evento y muestra su nombre en el filtro', async () => {
    await open();
    await respond(calls[0], pageOf([configEvent]));
    await click(button('Detalle de Edición'));
    await click(button('Ver eventos de este actor'));

    expect(url()).toBe('/audit?actorId=a1');
    expect(calls[1].params['actorId']).toBe('a1');
    expect(text()).toContain('Actor: Carolina Muñoz');

    await respond(calls[1], pageOf([configEvent]));
    await click(button('Quitar el filtro por Carolina Muñoz'));
    expect(url()).toBe('/audit');
  });

  it('no consulta con un rango de fechas invertido y envía un rango válido en hora de Chile', async () => {
    await open();
    await respond(calls[0], pageOf([configEvent]));

    form().patchValue({ from: new Date(2026, 10, 10), to: new Date(2026, 10, 1) });
    await settle();

    expect(calls.length).toBe(1);
    expect(text()).toContain('No puede ser anterior a "Desde"');

    form().patchValue({ to: new Date(2026, 10, 12) });
    await settle();

    expect(url()).toBe('/audit?from=2026-11-10&to=2026-11-12');
    expect(calls[1].params['from']).toBe('2026-11-10T03:00:00.000Z');
    expect(calls[1].params['to']).toBe('2026-11-13T02:59:59.999Z');
    expect(text()).not.toContain('Últimos 7 días');
  });

  it('muestra el servicio no disponible y reintenta con los mismos filtros', async () => {
    await open('/audit?actorRole=Auditor');
    await fail(calls[0], 503);

    expect(text()).toContain('La auditoría no está disponible');
    expect(element().querySelector('[role="alert"]')).not.toBeNull();

    await click(button('Reintentar'));
    expect(calls.length).toBe(2);
    expect(calls[1].params['actorRole']).toBe('Auditor');
  });

  it('distingue sin permiso y búsqueda inválida, sin ofrecer reintentar un 403', async () => {
    await open();
    await fail(calls[0], 403);
    expect(text()).toContain('No tienes acceso a la auditoría');
    expect(() => button('Reintentar')).toThrow();

    await harness.navigateByUrl('/audit?period=all');
    await settle();
    await fail(calls[1], 400);
    expect(text()).toContain('No se pudo aplicar la búsqueda');
  });

  it('Actualizar vuelve a consultar con los mismos filtros y conserva el detalle abierto', async () => {
    await open('/audit?actorRole=Admin');
    expect(text()).not.toContain('Consultado');
    await respond(calls[0], pageOf([configEvent]));
    expect(text()).toMatch(/Consultado \d{2}:\d{2}:\d{2}/);

    await click(button('Detalle de Edición'));
    await click(button('Actualizar'));

    expect(calls.length).toBe(2);
    expect(calls[1].params).toEqual(calls[0].params);
    expect(button('Actualizar').disabled).toBe(true);

    await respond(calls[1], pageOf([configEvent, requestEvent]));
    expect(element().querySelector('#audit-detail-e-config')).not.toBeNull();
    expect(text()).toContain('2 eventos');
  });

  it('distingue la lista vacía del error', async () => {
    await open();
    await respond(calls[0], pageOf([]));
    expect(text()).toContain('Sin eventos para estos filtros');
    expect(element().querySelector('[role="alert"]')).toBeNull();
  });

  it('muestra un evento histórico sin actor, folio ni details', async () => {
    await open();
    const old: AuditEvent = {
      eventId: 'e-old',
      eventType: 'request.created',
      occurredAt: '2026-10-01T12:00:00Z',
    };
    await respond(calls[0], pageOf([old]));
    await click(button('Detalle de Ingreso del trámite'));

    expect(text()).toContain('Sin nombre');
    expect(text()).toContain('Rol no registrado');
    expect(element().querySelector('#audit-detail-e-old pre')?.textContent).toContain('"e-old"');
  });

  it('vuelve a la última página si la de la URL ya no existe', async () => {
    await open('/audit?page=5');
    await respond(calls[0], pageOf([], { page: 5, totalElements: 30, totalPages: 2 }));

    expect(url()).toBe('/audit?page=1');
    expect(calls[1].params['page']).toBe('1');
  });

  it('reemplaza en la URL los valores inválidos por los que consulta', async () => {
    await open('/audit?actorRole=Root&size=999&period=all');
    expect(url()).toBe('/audit?period=all');
    expect(calls.length).toBe(1);
    expect(calls[0].params['actorRole']).toBeUndefined();
    expect(calls[0].params['size']).toBe('20');
  });

  it('en móvil muestra una lista y los filtros plegados', async () => {
    await open('/audit', false);
    await respond(calls[0], pageOf([configEvent, requestEvent]));

    expect(element().querySelector('table')).toBeNull();
    expect(element().querySelectorAll('.results__item').length).toBe(2);
    const panel = element().querySelector<HTMLElement>('#audit-filters-panel')!;
    expect(panel.hidden).toBe(true);

    const toggle = button('Filtros');
    expect(toggle.textContent).toContain('1');
    await click(toggle);
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
