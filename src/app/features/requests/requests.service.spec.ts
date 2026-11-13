import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
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
    rejectionReason: null,
    createdAt: '2026-09-13T15:04:05.123456Z',
    solicitanteId: 'oid-vecino',
    solicitanteNombre: '  Ana María Soto  ',
  };
  // Forma de MunicipalRequest serializada por ms-barriodigital-requests y reenviada por el BFF
  const response = { ...request, title: 'Bache en calle — Calle 1', updatedAt: request.createdAt };

  let service: RequestsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RequestsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const page = <T>(content: T[]) => ({
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
  });

  it('lista con GET al BFF, conserva la página y descarta title y updatedAt', async () => {
    const result = firstValueFrom(service.getRequests());

    const call = backend.expectOne(url);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.keys()).toEqual([]);
    call.flush({ ...page([response]), totalElements: 57, totalPages: 3 });

    expect(await result).toEqual({ ...page([request]), totalElements: 57, totalPages: 3 });
  });

  it('manda como query params solo los parámetros con valor', async () => {
    const result = firstValueFrom(
      service.getRequests({
        status: 'RESUELTO',
        from: '2026-09-01',
        to: '',
        q: 'BD-2026',
        sort: 'folio,asc',
        page: '2',
      }),
    );

    const call = backend.expectOne((req) => req.url === url);
    expect(call.request.params.get('status')).toBe('RESUELTO');
    expect(call.request.params.get('from')).toBe('2026-09-01');
    expect(call.request.params.get('q')).toBe('BD-2026');
    expect(call.request.params.get('sort')).toBe('folio,asc');
    expect(call.request.params.get('page')).toBe('2');
    expect(call.request.params.has('to')).toBe(false);
    call.flush(page([]));

    expect((await result).content).toEqual([]);
  });

  it('crea con POST mandando solo procedureType, description y address', async () => {
    const payload = {
      procedureType: 'bache',
      description: 'Hueco frente al 123',
      address: 'Calle 1',
    };
    const result = firstValueFrom(service.createRequest(payload));

    const call = backend.expectOne(url);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(payload);
    call.flush(response, { status: 201, statusText: 'Created' });

    expect(await result).toEqual(request);
  });

  it('crea con imagen como partes multipart sin fijar manualmente el Content-Type', async () => {
    const payload = {
      procedureType: 'bache',
      description: 'Hueco frente al 123',
      address: 'Calle 1',
    };
    const attachment = new File(['image'], 'evidencia.png', { type: 'image/png' });
    const result = firstValueFrom(service.createRequestWithAttachment(payload, attachment));

    const call = backend.expectOne(url);
    expect(call.request.method).toBe('POST');
    expect(call.request.headers.has('Content-Type')).toBe(false);
    expect(call.request.body).toBeInstanceOf(FormData);
    const formData = call.request.body as FormData;
    // FormData.append con nombre crea un File nuevo, así que se compara su contenido y no la identidad
    const attachmentPart = formData.get('attachment');
    expect(attachmentPart).toBeInstanceOf(File);
    const sentFile = attachmentPart as File;
    expect(sentFile.name).toBe('evidencia');
    expect(sentFile.type).toBe(attachment.type);
    expect(sentFile.size).toBe(attachment.size);
    expect(await sentFile.text()).toBe(await attachment.text());
    const requestPart = formData.get('request');
    expect(requestPart).toBeInstanceOf(Blob);
    expect(await (requestPart as Blob).text()).toBe(JSON.stringify(payload));
    call.flush({ ...response, hasAttachment: true }, { status: 201, statusText: 'Created' });

    expect(await result).toEqual({ ...request, hasAttachment: true });
  });

  it('descarga una imagen por el endpoint autenticado del BFF', async () => {
    const result = firstValueFrom(service.getAttachment(request.id));

    const call = backend.expectOne(`${url}/${request.id}/attachment`);
    expect(call.request.method).toBe('GET');
    expect(call.request.responseType).toBe('blob');
    const image = new Blob(['image'], { type: 'image/png' });
    call.flush(image);

    expect(await result).toBe(image);
  });

  it('propaga el error del BFF para que la vista muestre su estado de error', async () => {
    const result = firstValueFrom(service.getRequests());

    backend
      .expectOne(url)
      .flush({ error: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toMatchObject({ status: 400 });
  });

  it('cambia el estado con PUT y conserva el nombre persistido y la identidad del creador', async () => {
    const result = firstValueFrom(service.changeStatus(request.id, { status: 'ADMITIDO' }));
    const call = backend.expectOne(`${url}/${request.id}/status`);

    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ status: 'ADMITIDO' });
    call.flush({ ...response, status: 'ADMITIDO' });

    expect(await result).toEqual({ ...request, status: 'ADMITIDO' });
  });

  describe.each(['GET', 'POST', 'PUT'] as const)('mapeo %s', (method) => {
    it.each([null, undefined, '', '   '])(
      'conserva el nombre %j sin aplicar un respaldo',
      async (name) => {
        const raw = { ...response, solicitanteNombre: name };
        if (name === undefined) delete raw.solicitanteNombre;
        const payload = { procedureType: 'bache', description: 'Descripción', address: 'Calle 1' };
        const result = firstValueFrom<Request | Page<Request>>(
          method === 'GET'
            ? service.getRequests()
            : method === 'POST'
              ? service.createRequest(payload)
              : service.changeStatus(request.id, { status: 'ADMITIDO' }),
        );

        const call = backend.expectOne(method === 'PUT' ? `${url}/${request.id}/status` : url);
        expect(call.request.method).toBe(method);
        call.flush(method === 'GET' ? page([raw]) : raw);

        const mapped = await result;
        const item = 'content' in mapped ? mapped.content[0] : mapped;
        expect(item.solicitanteNombre).toBe(name);
        expect(item.solicitanteId).toBe(request.solicitanteId);
      },
    );
  });

  it('asigna con PUT /assignee y devuelve el trámite con su responsable', async () => {
    const result = firstValueFrom(
      service.assign(request.id, { assigneeId: 'oid-ana', reason: 'Cambio de turno' }),
    );
    const call = backend.expectOne(`${url}/${request.id}/assignee`);

    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ assigneeId: 'oid-ana', reason: 'Cambio de turno' });
    call.flush({ ...response, hasAssignee: true, assigneeId: 'oid-ana', assigneeName: 'Ana' });

    expect(await result).toMatchObject({ assigneeId: 'oid-ana', assigneeName: 'Ana' });
  });

  it('lista los funcionarios con GET /assignees, una ruta literal', async () => {
    const result = firstValueFrom(service.getAssignees());
    const call = backend.expectOne(`${url}/assignees`);

    expect(call.request.method).toBe('GET');
    call.flush([{ id: 'oid-ana', name: 'Ana' }]);

    expect(await result).toEqual([{ id: 'oid-ana', name: 'Ana' }]);
  });
});
