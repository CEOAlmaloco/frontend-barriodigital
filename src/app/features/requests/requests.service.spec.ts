import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Request } from '../../shared/models/request.model';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  const url = `${environment.bffBaseUrl}/api/requests`;
  const request: Request = {
    id: 'a1e3c5d7-0001-4f00-8000-000000000001',
    description: 'Hueco frente al 123',
    procedureType: 'bache',
    address: 'Calle 1',
    status: 'INGRESADO',
    createdAt: '2026-09-13T15:04:05.123456Z',
    solicitanteId: 'oid-vecino',
  };
  // Forma de MunicipalRequest serializada por ms-barriodigital-requests y reenviada por el BFF
  const response = { ...request, title: 'Bache en calle — Calle 1', updatedAt: request.createdAt };

  let service: RequestsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RequestsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lista con GET al BFF y descarta title y updatedAt', async () => {
    const result = firstValueFrom(service.getRequests());

    const call = backend.expectOne(url);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.keys()).toEqual([]);
    call.flush([response]);

    expect(await result).toEqual([request]);
  });

  it('manda solo los filtros con valor como query params status, from y to', async () => {
    const result = firstValueFrom(service.getRequests({ status: 'RESUELTO', from: '2026-09-01', to: '' }));

    const call = backend.expectOne((req) => req.url === url);
    expect(call.request.params.get('status')).toBe('RESUELTO');
    expect(call.request.params.get('from')).toBe('2026-09-01');
    expect(call.request.params.has('to')).toBe(false);
    call.flush([]);

    expect(await result).toEqual([]);
  });

  it('crea con POST mandando solo procedureType, description y address', async () => {
    const payload = { procedureType: 'bache', description: 'Hueco frente al 123', address: 'Calle 1' };
    const result = firstValueFrom(service.createRequest(payload));

    const call = backend.expectOne(url);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(payload);
    call.flush(response, { status: 201, statusText: 'Created' });

    expect(await result).toEqual(request);
  });

  it('propaga el error del BFF para que la vista muestre su estado de error', async () => {
    const result = firstValueFrom(service.getRequests());

    backend.expectOne(url).flush({ error: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toMatchObject({ status: 400 });
  });
});
