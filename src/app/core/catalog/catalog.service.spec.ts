import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const url = `${environment.bffBaseUrl}/api/catalog/procedures`;
  let service: CatalogService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('consulta el BFF con GET y conserva activos, inactivos y cupos', async () => {
    const catalog = [
      {
        value: 'nuevo',
        label: 'Etiqueta del backend',
        active: true,
        dailyQuota: 5,
        remainingQuota: 2,
      },
      {
        value: 'agotado',
        label: 'Cupo agotado',
        active: true,
        dailyQuota: 5,
        remainingQuota: 0,
      },
      {
        value: 'anterior',
        label: 'Etiqueta histórica',
        active: false,
        dailyQuota: null,
        remainingQuota: null,
      },
    ];
    const result = firstValueFrom(service.getProcedures());
    const call = backend.expectOne(url);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.keys()).toEqual([]);
    call.flush(catalog);
    expect(await result).toEqual(catalog);
  });

  it('acepta un catálogo vacío', async () => {
    const result = firstValueFrom(service.getProcedures());
    backend.expectOne(url).flush([]);
    expect(await result).toEqual([]);
  });

  const procedure: ProcedureType = {
    value: 'semaforo',
    label: 'Semáforo',
    active: false,
    dailyQuota: null,
    remainingQuota: null,
  };

  it('crea con POST y solo los tres campos de creación', async () => {
    const result = firstValueFrom(service.createProcedure(procedure));
    const call = backend.expectOne(url);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({ value: 'semaforo', label: 'Semáforo', active: false });
    call.flush(procedure, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(procedure);
  });

  it.each([
    { label: 'Otro nombre', active: true, dailyQuota: 10 },
    { label: 'Semáforo', active: false, dailyQuota: 10 },
    { label: 'Semáforo', active: true, dailyQuota: null },
  ])('actualiza por PUT con cupo explícito: %j', async (body) => {
    const responseFields = { ...body, remainingQuota: 2 };
    const result = firstValueFrom(service.updateProcedure('semaforo', responseFields));
    const call = backend.expectOne(`${url}/semaforo`);
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual(body);
    expect(call.request.body).not.toHaveProperty('remainingQuota');
    call.flush({ ...procedure, ...body });
    expect(await result).toEqual({ ...procedure, ...body });
  });

  it('codifica el segmento de ruta sin añadir encabezados de roles', async () => {
    const result = firstValueFrom(
      service.updateProcedure('codigo/ajeno', {
        label: 'Nombre',
        active: true,
        dailyQuota: null,
      }),
    );
    const call = backend.expectOne(`${url}/codigo%2Fajeno`);
    expect(call.request.headers.has('X-User-Roles')).toBe(false);
    call.flush(procedure);
    await result;
  });

  it.each(['create', 'update'] as const)(
    'propaga errores de %s sin repetir escrituras',
    async (mode) => {
      const request =
        mode === 'create'
          ? service.createProcedure(procedure)
          : service.updateProcedure(procedure.value, procedure);
      const result = firstValueFrom(request);
      backend
        .expectOne(mode === 'create' ? url : `${url}/semaforo`)
        .flush({ message: 'No disponible' }, { status: 400, statusText: 'Bad Request' });
      await expect(result).rejects.toMatchObject({
        status: 400,
        error: { message: 'No disponible' },
      });
      backend.expectNone(() => true);
    },
  );

  it('propaga el error sin reintentar automáticamente', async () => {
    const result = firstValueFrom(service.getProcedures());
    backend
      .expectOne(url)
      .flush(
        { message: 'Catálogo no disponible' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await expect(result).rejects.toMatchObject({
      status: 503,
      error: { message: 'Catálogo no disponible' },
    });
  });
});
