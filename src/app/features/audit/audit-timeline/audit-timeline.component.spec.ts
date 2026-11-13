import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';

import { AuditService } from '../../../core/audit/audit.service';
import { AuditEvent } from '../../../shared/models/audit.model';
import { Page } from '../../../shared/models/page.model';
import { AuditTimelineComponent } from './audit-timeline.component';

@Component({ template: '' })
class OtherComponent {}

interface Call {
  params: Record<string, string>;
  subject: Subject<Page<AuditEvent>>;
}

const base = {
  producer: 'requests',
  resourceType: 'request',
  resourceId: 'r1',
  requestId: '7b6e1d44-2a18-4c90-9f01-88aa11bb22cc',
  folio: 'BD-2026-000412',
};

const created: AuditEvent = {
  ...base,
  eventId: 'e1',
  eventType: 'request.created',
  occurredAt: '2026-11-10T12:14:00Z',
  sequence: 1,
  actor: { id: 'v1', name: 'Pedro Catrileo', role: 'Vecino', sourceIp: null },
  details: { procedureLabel: 'Bache en calle', sector: 'ralco', slaBusinessDays: 5 },
};

const rejected: AuditEvent = {
  ...base,
  eventId: 'e2',
  eventType: 'request.status-changed',
  occurredAt: '2026-11-13T19:20:00Z',
  sequence: 2,
  actor: { id: 'a1', name: 'Carolina Muñoz', role: 'Admin', sourceIp: null },
  details: {
    fromStatus: 'INGRESADO',
    toStatus: 'RECHAZADO',
    reason: 'Fuera de la comuna',
    interventionReason: 'Funcionario con licencia',
  },
};

const pageOf = (
  content: AuditEvent[],
  overrides: Partial<Page<AuditEvent>> = {},
): Page<AuditEvent> => ({
  content,
  page: 0,
  size: 50,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  ...overrides,
});

describe('AuditTimelineComponent', () => {
  let harness: RouterTestingHarness;
  let calls: Call[];

  const element = () => harness.routeNativeElement as HTMLElement;
  const text = () => (element().textContent ?? '').replace(/\s+/g, ' ').trim();
  const url = () => TestBed.inject(Router).url;
  const input = () => element().querySelector<HTMLInputElement>('input')!;
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
  };
  const respond = async (call: Call | undefined, page: Page<AuditEvent>) => {
    call!.subject.next(page);
    call!.subject.complete();
    await settle();
  };
  const search = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };

  async function open(path = '/audit?view=timeline') {
    calls = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'audit', component: AuditTimelineComponent },
          { path: 'tramites/:id', component: OtherComponent },
        ]),
        {
          provide: AuditService,
          useValue: {
            getTimeline: (params: Record<string, string>) => {
              const subject = new Subject<Page<AuditEvent>>();
              calls.push({ params, subject });
              return subject;
            },
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create(path);
    await settle();
  }

  it('sin folio solo muestra la búsqueda y no consulta', async () => {
    await open();
    expect(calls.length).toBe(0);
    expect(text()).toContain('Formato BD-AAAA-NNNNNN, como figura en el comprobante.');
    expect(element().querySelector('ol')).toBeNull();
  });

  it('valida el formato antes de consultar', async () => {
    await open();
    await search('bd 2026 412');
    expect(calls.length).toBe(0);
    expect(text()).toContain('Usa el formato BD-AAAA-NNNNNN.');

    await search('');
    expect(text()).toContain('Ingresa un folio.');
  });

  it('normaliza el folio y consulta el historial completo, sin filtro de fechas', async () => {
    await open();
    await search('  bd-2026-000412 ');

    expect(url()).toBe('/audit?view=timeline&folio=BD-2026-000412');
    expect(calls[0].params).toEqual({ folio: 'BD-2026-000412', page: '0', size: '50' });
    expect(input().value).toBe('BD-2026-000412');
  });

  it('muestra el historial en orden, con actor, intervención y datos originales', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000412');
    await respond(calls[0], pageOf([created, rejected]));

    const items = [...element().querySelectorAll('.timeline__item')];
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Ingreso del trámite');
    expect(items[0].textContent).toContain('10/11/2026 09:14:00');
    expect(items[0].textContent).toContain('Pedro Catrileo');
    expect(items[1].textContent).toContain('Cambio de estado: Ingresado → Rechazado');
    expect(items[1].textContent).toContain('Funcionario con licencia');
    expect(items[1].querySelector('pre')?.textContent).toContain('"eventId": "e2"');
    expect(text()).toContain('2 eventos');
    expect(element().querySelector('h2#timeline-title')?.textContent).toContain('Bache en calle');
    expect(
      element().querySelector('h2#timeline-title app-request-status-badge')?.textContent,
    ).toContain('Rechazado');
    expect(text()).not.toContain('Del más antiguo al más reciente');
    expect(text()).not.toContain('Hora de Chile');
    const detailLink = [...element().querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Abrir trámite'),
    );
    expect(detailLink?.getAttribute('href')).toBe('/tramites/7b6e1d44-2a18-4c90-9f01-88aa11bb22cc');
  });

  it('descarta la respuesta de un folio anterior que llega después del nuevo', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000001');
    await search('BD-2026-000412');

    expect(calls.length).toBe(2);
    expect(calls[0].subject.observed).toBe(false);

    await respond(calls[1], pageOf([created]));
    calls[0].subject.next(pageOf([rejected, rejected]));
    await settle();

    expect(element().querySelectorAll('.timeline__item').length).toBe(1);
    expect(text()).toContain('BD-2026-000412');
  });

  it('Actualizar vuelve a consultar el mismo folio', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000412');
    await respond(calls[0], pageOf([created]));

    const refresh = [...element().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Actualizar'),
    )!;
    refresh.click();
    await settle();

    expect(calls.length).toBe(2);
    expect(calls[1].params).toEqual(calls[0].params);
    await respond(calls[1], pageOf([created, rejected]));
    expect(element().querySelectorAll('.timeline__item').length).toBe(2);
    expect(text()).toMatch(/Consultado \d{2}:\d{2}:\d{2}/);
  });

  it('en pantallas angostas consulta con el ícono del campo, que tiene nombre accesible', async () => {
    await open();
    const icon = element().querySelector<HTMLButtonElement>('.timeline__submit-icon')!;
    expect(icon.type).toBe('submit');
    expect(icon.getAttribute('aria-label')).toBe('Consultar');
    expect(icon.closest('form')).not.toBeNull();
  });

  it('distingue el historial vacío del error', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000999');
    await respond(calls[0], pageOf([]));
    expect(text()).toContain('Sin eventos registrados');
    expect(text()).toContain(
      'El folio no existe o el trámite es anterior al registro de auditoría.',
    );
    expect(element().querySelector('[role="alert"]')).toBeNull();
  });

  it('consulta por requestId cuando el trámite no tiene folio', async () => {
    await open('/audit?view=timeline&requestId=7B6E1D44-2A18-4C90-9F01-88AA11BB22CC');
    expect(url()).toBe('/audit?view=timeline&requestId=7b6e1d44-2a18-4c90-9f01-88aa11bb22cc');
    expect(calls[0].params['requestId']).toBe('7b6e1d44-2a18-4c90-9f01-88aa11bb22cc');
    expect(calls[0].params['folio']).toBeUndefined();

    await respond(calls[0], pageOf([{ ...created, folio: null }]));
    expect(text()).toContain('Trámite sin folio');
  });

  it('muestra el servicio no disponible y reintenta el mismo folio', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000412');
    calls[0].subject.error(new HttpErrorResponse({ status: 503 }));
    await settle();

    expect(text()).toContain('La auditoría no está disponible');
    const retry = [...element().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Reintentar'),
    )!;
    retry.click();
    await settle();
    expect(calls.length).toBe(2);
    expect(calls[1].params['folio']).toBe('BD-2026-000412');
  });

  it('pagina un historial largo y conserva la página anterior mientras carga', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000412');
    await respond(calls[0], pageOf([created], { totalElements: 60, totalPages: 2 }));
    expect(element().querySelector('mat-paginator')).not.toBeNull();
    // Solo la última página dice cuál es el último estado registrado
    expect(element().querySelector('h2#timeline-title app-request-status-badge')).toBeNull();

    await harness.navigateByUrl('/audit?view=timeline&folio=BD-2026-000412&page=1');
    await settle();
    expect(calls[1].params['page']).toBe('1');
    expect(element().querySelectorAll('.timeline__item').length).toBe(1);
    expect(element().querySelector('mat-progress-bar')).not.toBeNull();
  });
});
