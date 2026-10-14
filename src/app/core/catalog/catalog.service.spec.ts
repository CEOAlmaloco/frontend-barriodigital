import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
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

  it('consulta el BFF con GET y conserva activos, inactivos y labels sin campos de cupos', async () => {
    const catalog = [
      { value: 'nuevo', label: 'Etiqueta del backend', active: true },
      { value: 'anterior', label: 'Etiqueta histórica', active: false },
    ];
    const result = firstValueFrom(service.getProcedures());
    const call = backend.expectOne(url);
    expect(call.request.method).toBe('GET');
    expect(call.request.params.keys()).toEqual([]);
    call.flush(catalog.map((type) => ({ ...type, dailyQuota: 5, remainingQuota: 2 })));
    expect(await result).toEqual(catalog);
  });

  it('acepta un catálogo vacío', async () => {
    const result = firstValueFrom(service.getProcedures());
    backend.expectOne(url).flush([]);
    expect(await result).toEqual([]);
  });

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
