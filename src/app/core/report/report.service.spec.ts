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
});
