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

  it('exporta el CSV por la ruta literal, con los filtros y como archivo', async () => {
    const result = firstValueFrom(
      service.exportRequests({ status: 'EN_GESTION', assignee: 'me', q: '' }),
    );

    const call = backend.expectOne((req) => req.url === `${url}/export`);
    expect(call.request.method).toBe('GET');
    expect(call.request.responseType).toBe('blob');
    expect(call.request.params.keys()).toEqual(['status', 'assignee']);
    expect(call.request.params.get('assignee')).toBe('me');
    const csv = new Blob(['﻿"Folio"\r\n'], { type: 'text/csv' });
    call.flush(csv);

    expect(await result).toBe(csv);
  });

  it('propaga el error del BFF para que la vista muestre su estado de error', async () => {
    const result = firstValueFrom(service.getRequests());

    backend
      .expectOne(url)
      .flush({ error: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toMatchObject({ status: 400 });
  });

  it('califica con POST /rating y conserva satisfactionScore', async () => {
    const result = firstValueFrom(service.rate(request.id, { score: 5, comment: 'Rapido' }));
    const call = backend.expectOne(`${url}/${request.id}/rating`);

    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({ score: 5, comment: 'Rapido' });
    call.flush({ ...response, status: 'RESUELTO', satisfactionScore: 5, satisfactionComment: 'Rapido' });

    expect(await result).toEqual({
      ...request,
      status: 'RESUELTO',
      satisfactionScore: 5,
      satisfactionComment: 'Rapido',
    });
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

  describe('comentario del vecino (EP3-64)', () => {
    const activity = {
      requestId: request.id,
      eventos: [],
      tiempos: {},
      contacto: null,
      limites: [],
    };

    it('sin imagen envía JSON y devuelve el historial', async () => {
      const result = firstValueFrom(service.addComment(request.id, 'Se acumula agua'));
      const call = backend.expectOne(`${url}/${request.id}/comments`);

      expect(call.request.method).toBe('POST');
      expect(call.request.body).toEqual({ text: 'Se acumula agua' });
      call.flush(activity);

      expect(await result).toEqual(activity);
    });

    it('con imagen envía multipart con las partes comment y attachment', async () => {
      const image = new File(['png'], 'foto.png', { type: 'image/png' });
      const result = firstValueFrom(service.addComment(request.id, 'Se acumula agua', image));
      const call = backend.expectOne(`${url}/${request.id}/comments`);

      const body = call.request.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      const comment = body.get('comment') as Blob;
      expect(comment.type).toBe('application/json');
      expect(JSON.parse(await comment.text())).toEqual({ text: 'Se acumula agua' });
      expect((body.get('attachment') as File).name).toBe('evidencia');
      call.flush(activity);

      expect(await result).toEqual(activity);
    });

    it('pide la foto de un comentario como blob con el id del evento', async () => {
      const result = firstValueFrom(service.getCommentAttachment(request.id, 'ev-7'));
      const call = backend.expectOne(`${url}/${request.id}/comments/ev-7/attachment`);

      expect(call.request.method).toBe('GET');
      expect(call.request.responseType).toBe('blob');
      call.flush(new Blob(['jpg'], { type: 'image/jpeg' }));

      expect((await result).type).toBe('image/jpeg');
    });
  });

  describe('posibles duplicados (EP3-75)', () => {
    it('con punto y sector envía los cuatro parámetros', async () => {
      const result = firstValueFrom(
        service.findDuplicates({
          procedureType: 'bache',
          latitude: -37.8742,
          longitude: -71.5915,
          sector: 'ralco',
        }),
      );
      const call = backend.expectOne((req) => req.url === `${url}/duplicates`);

      expect(call.request.method).toBe('GET');
      expect(call.request.params.get('procedureType')).toBe('bache');
      expect(call.request.params.get('latitude')).toBe('-37.8742');
      expect(call.request.params.get('longitude')).toBe('-71.5915');
      expect(call.request.params.get('sector')).toBe('ralco');
      call.flush([]);

      expect(await result).toEqual([]);
    });

    it('solo con sector no envía coordenadas', () => {
      service.findDuplicates({ procedureType: 'bache', sector: 'ralco' }).subscribe();
      const call = backend.expectOne((req) => req.url === `${url}/duplicates`);

      expect(call.request.params.keys()).toEqual(['procedureType', 'sector']);
      call.flush([]);
    });
  });

  it('lee y guarda preferencias de aviso en /me/notification-preferences', async () => {
    const getResult = firstValueFrom(service.getNotificationPreferences());
    const getCall = backend.expectOne(`${url}/me/notification-preferences`);
    expect(getCall.request.method).toBe('GET');
    getCall.flush({ emailEnabled: true });
    expect(await getResult).toEqual({ emailEnabled: true });

    const putResult = firstValueFrom(service.updateNotificationPreferences(false));
    const putCall = backend.expectOne(`${url}/me/notification-preferences`);
    expect(putCall.request.method).toBe('PUT');
    expect(putCall.request.body).toEqual({ emailEnabled: false });
    putCall.flush({ emailEnabled: false });
    expect(await putResult).toEqual({ emailEnabled: false });
  });
});
