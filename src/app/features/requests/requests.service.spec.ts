import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { toDateKey } from './date-key';
import { REQUEST_STATUSES } from './requests.constants';
import { RequestsService } from './requests.service';

describe('RequestsService (mock)', () => {
  let service: RequestsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { userId: signal('vecino-actual') } }],
    });
    service = TestBed.inject(RequestsService);
  });

  it('entrega entre 6 y 8 trámites que cubren los seis estados', async () => {
    const requests = await firstValueFrom(service.getRequests());

    expect(requests.length).toBeGreaterThanOrEqual(6);
    expect(requests.length).toBeLessThanOrEqual(8);
    expect(new Set(requests.map((request) => request.estado))).toEqual(new Set(REQUEST_STATUSES));
  });

  it('filtra por estado y por rango de fechas, igual que los query params del GET real', async () => {
    const resolved = await firstValueFrom(service.getRequests({ status: 'RESUELTO' }));
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.every((request) => request.estado === 'RESUELTO')).toBe(true);

    const from = toDateKey(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000));
    const recent = await firstValueFrom(service.getRequests({ from, to: toDateKey(new Date()) }));
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.every((request) => toDateKey(new Date(request.fechaCreacion)) >= from)).toBe(true);
  });

  it('crea el trámite en INGRESADO, a nombre de la cuenta activa, y lo incluye en el listado', async () => {
    const created = await firstValueFrom(
      service.createRequest({ tipo: 'Otro', descripcion: 'Prueba', direccion: 'Calle 1' }),
    );

    expect(created.estado).toBe('INGRESADO');
    expect(created.solicitanteId).toBe('vecino-actual');

    const requests = await firstValueFrom(service.getRequests());
    expect(requests.some((request) => request.id === created.id)).toBe(true);
  });
});
