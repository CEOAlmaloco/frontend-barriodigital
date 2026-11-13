import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ReportService } from './report.service';

describe('ReportService', () => {
  const url = `${environment.bffBaseUrl}/api/report`;
  let service: ReportService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pide los KPIs del período con GET', async () => {
    const result = firstValueFrom(service.getKpis('last7d'));
    const call = backend.expectOne((req) => req.url === `${url}/kpis`);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.get('range')).toBe('last7d');
    call.flush({ range: 'last7d' });
    expect(await result).toEqual({ range: 'last7d' });
  });

  it('pide los 5 tipos más demandados del período por defecto', async () => {
    const result = firstValueFrom(service.getTopProcedures('last24h'));
    const call = backend.expectOne((req) => req.url === `${url}/top-procedures`);
    expect(call.request.params.get('range')).toBe('last24h');
    expect(call.request.params.get('limit')).toBe('5');
    call.flush({ range: 'last24h', items: [], lastEventAt: null });
    expect((await result).items).toEqual([]);
  });

  it('pide los plazos del responsable con los dos estados por omisión', async () => {
    const result = firstValueFrom(service.getSlaAlerts({ assignee: 'me', page: 1, size: 5 }));
    const call = backend.expectOne((req) => req.url === `${url}/sla`);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.get('assignee')).toBe('me');
    expect(call.request.params.has('status')).toBe(false);
    expect(call.request.params.get('page')).toBe('1');
    expect(call.request.params.get('size')).toBe('5');
    call.flush({
      content: [],
      page: 1,
      size: 5,
      totalElements: 0,
      totalPages: 0,
      lastEventAt: null,
    });
    expect((await result).totalElements).toBe(0);
  });

  it('pide solo los vencidos de la comuna sin filtro de responsable', () => {
    service.getSlaAlerts({ status: ['VENCIDO'], page: 0, size: 5 }).subscribe();
    const call = backend.expectOne((req) => req.url === `${url}/sla`);
    expect(call.request.params.get('status')).toBe('VENCIDO');
    expect(call.request.params.has('assignee')).toBe(false);
    call.flush({
      content: [],
      page: 0,
      size: 5,
      totalElements: 0,
      totalPages: 0,
      lastEventAt: null,
    });
  });
});
