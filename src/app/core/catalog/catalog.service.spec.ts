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

  it('consulta el BFF con GET y conserva activos, inactivos, cupos y plazos', async () => {
    const catalog = [
      {
        value: 'nuevo',
        label: 'Etiqueta del backend',
        active: true,
        dailyQuota: 5,
        remainingQuota: 2,
        slaBusinessDays: 10,
      },
      {
        value: 'agotado',
        label: 'Cupo agotado',
        active: true,
        dailyQuota: 5,
        remainingQuota: 0,
        slaBusinessDays: 1,
      },
      {
        value: 'anterior',
        label: 'Etiqueta histórica',
        active: false,
        dailyQuota: null,
        remainingQuota: null,
        slaBusinessDays: null,
      },
    ];
    const result = firstValueFrom(service.getProcedures());
    const call = backend.expectOne(url);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.keys()).toEqual([]);
    call.flush(catalog);
    expect(await result).toEqual(catalog);
  });

  it('un tipo sin el campo de plazo, de un catalog anterior, queda sin plazo y no undefined', async () => {
    const result = firstValueFrom(service.getProcedures());
    backend
      .expectOne(url)
      .flush([
        { value: 'bache', label: 'Bache', active: true, dailyQuota: null, remainingQuota: null },
      ]);
    expect((await result)[0].slaBusinessDays).toBeNull();
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
    slaBusinessDays: 5,
  };

  it('crea con POST, con el plazo y sin el cupo, que catalog crea sin límite', async () => {
    const result = firstValueFrom(service.createProcedure(procedure));
    const call = backend.expectOne(url);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({
      value: 'semaforo',
      label: 'Semáforo',
      active: false,
      slaBusinessDays: 5,
    });
    call.flush(procedure, { status: 201, statusText: 'Created' });
    expect(await result).toEqual(procedure);
  });

  // El PUT reemplaza el plazo: sin el campo, catalog dejaría el tipo sin plazo (EP3-06, sección 1.1)
  it.each([
    { label: 'Otro nombre', active: true, dailyQuota: 10, slaBusinessDays: 5 },
    { label: 'Semáforo', active: false, dailyQuota: 10, slaBusinessDays: 120 },
    { label: 'Semáforo', active: true, dailyQuota: null, slaBusinessDays: null },
  ])('actualiza por PUT con cupo y plazo explícitos: %j', async (body) => {
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
        slaBusinessDays: null,
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

  describe('nombres para las vistas', () => {
    const type = (value: string, label: string) => ({
      value,
      label,
      active: false,
      dailyQuota: null,
      remainingQuota: null,
    });

    it('cualquier consulta del catálogo actualiza los nombres, incluidos los inactivos', () => {
      service.getProcedures().subscribe();
      backend.expectOne(url).flush([type('bache', 'Bache en calzada')]);

      expect(service.labels().get('bache')).toBe('Bache en calzada');
      service.loadLabels();
      backend.expectNone(url);
    });

    it('loadLabels consulta una sola vez aunque varias vistas lo pidan', () => {
      service.loadLabels();
      service.loadLabels();
      backend.expectOne(url).flush([type('poda', 'Poda de árboles')]);

      expect(service.labels().get('poda')).toBe('Poda de árboles');
    });

    it('una falla deja los nombres vacíos y la próxima vista vuelve a intentar', () => {
      service.loadLabels();
      backend.expectOne(url).flush(null, { status: 503, statusText: 'Service Unavailable' });
      expect(service.labels().size).toBe(0);

      service.loadLabels();
      backend.expectOne(url).flush([type('bache', 'Bache en calzada')]);
      expect(service.labels().size).toBe(1);
    });
  });
});
