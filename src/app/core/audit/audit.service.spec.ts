import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const url = `${environment.bffBaseUrl}/api/audit`;
  const emptyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  let service: AuditService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('busca eventos con GET y no envía los parámetros vacíos', async () => {
    const result = firstValueFrom(
      service.searchEvents({
        actorRole: 'Admin',
        eventType: 'queue.purged,queue.deleted',
        from: '',
      }),
    );
    const call = backend.expectOne((req) => req.url === `${url}/events`);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.get('actorRole')).toBe('Admin');
    expect(call.request.params.get('eventType')).toBe('queue.purged,queue.deleted');
    expect(call.request.params.has('from')).toBe(false);
    call.flush(emptyPage);
    expect(await result).toEqual(emptyPage);
  });

  it('pide el timeline de un trámite por folio', async () => {
    const result = firstValueFrom(service.getTimeline({ folio: 'BD-2026-000412', size: '50' }));
    const call = backend.expectOne((req) => req.url === `${url}/timeline`);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.get('folio')).toBe('BD-2026-000412');
    expect(call.request.params.has('requestId')).toBe(false);
    expect(call.request.params.get('size')).toBe('50');
    call.flush(emptyPage);
    expect((await result).content).toEqual([]);
  });
});
