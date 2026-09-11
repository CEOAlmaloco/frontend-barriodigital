import { Injectable, inject } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Request, CreateRequestPayload } from '../../shared/models/request.model';
import { toDateKey } from './date-key';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// Solicitantes ficticios: ninguno corresponde a una cuenta real del tenant
const VECINA_ALAMEDA = '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c01';
const VECINO_ROBLES = '8b2d4e61-1a3f-4c5d-8e9f-0a1b2c3d4e02';
const VECINA_PINARES = 'c7e5f083-2b4a-4d6c-9f1e-3a5b7c9d1e03';

// DEUDA TECNICA (EP1-08): este servicio usa datos mock porque el backend real
// (ms-barriodigital-requests, EP1-14/EP1-15) todavia no esta disponible.
// Cuando el endpoint real exista, reemplazar el cuerpo de getRequests() y
// createRequest() por llamadas HttpClient contra `${environment.bffBaseUrl}/api/requests`,
// sin cambiar la firma de los metodos ni el resto de la UI que consume este servicio.
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly auth = inject(AuthService);

  private mockData: Request[] = [
    {
      id: 'a1e3c5d7-0001-4f00-8000-000000000001',
      tipo: 'Poda de árbol',
      descripcion: 'Rama grande apoyada sobre el cable del alumbrado frente al número 1234.',
      direccion: 'Av. Los Aromos 1234',
      estado: 'INGRESADO',
      fechaCreacion: daysAgo(2),
      solicitanteId: VECINA_ALAMEDA,
    },
    {
      id: 'a1e3c5d7-0002-4f00-8000-000000000002',
      tipo: 'Bache en calle',
      descripcion: 'Bache profundo en la esquina; ya dañó la rueda de un auto.',
      direccion: 'Calle Las Rosas esquina Pasaje 5',
      estado: 'ADMITIDO',
      fechaCreacion: daysAgo(5),
      solicitanteId: VECINO_ROBLES,
    },
    {
      id: 'a1e3c5d7-0003-4f00-8000-000000000003',
      tipo: 'Alumbrado público',
      descripcion: 'Tres postes sin luz en la cuadra desde hace una semana.',
      direccion: 'Pasaje El Roble 45',
      estado: 'EN_GESTION',
      fechaCreacion: daysAgo(9),
      solicitanteId: VECINA_ALAMEDA,
    },
    {
      id: 'a1e3c5d7-0004-4f00-8000-000000000004',
      tipo: 'Recolección de escombros',
      descripcion: 'Escombros de una demolición abandonados en la vereda, bloquean el paso.',
      direccion: 'Calle Los Pinos 890',
      estado: 'EN_TERRENO',
      fechaCreacion: daysAgo(14),
      solicitanteId: VECINA_PINARES,
    },
    {
      id: 'a1e3c5d7-0005-4f00-8000-000000000005',
      tipo: 'Ruidos molestos',
      descripcion: 'Taller mecánico que trabaja con maquinaria pasada la medianoche.',
      direccion: 'Av. Central 2050',
      estado: 'RESUELTO',
      fechaCreacion: daysAgo(20),
      solicitanteId: VECINO_ROBLES,
    },
    {
      id: 'a1e3c5d7-0006-4f00-8000-000000000006',
      tipo: 'Otro',
      descripcion: 'Solicitud de un lomo de toro frente a la entrada del colegio.',
      direccion: 'Calle Escuela 12',
      estado: 'RECHAZADO',
      fechaCreacion: daysAgo(27),
      solicitanteId: VECINA_ALAMEDA,
    },
    {
      id: 'a1e3c5d7-0007-4f00-8000-000000000007',
      tipo: 'Poda de árbol',
      descripcion: 'Árbol seco con riesgo de caída junto a los juegos infantiles.',
      direccion: 'Plaza Los Héroes s/n',
      estado: 'RESUELTO',
      fechaCreacion: daysAgo(33),
      solicitanteId: VECINA_PINARES,
    },
  ];

  getRequests(filters?: { status?: string; from?: string; to?: string }): Observable<Request[]> {
    const { status, from, to } = filters ?? {};
    const requests = this.mockData.filter((request) => {
      const day = toDateKey(new Date(request.fechaCreacion));
      return (!status || request.estado === status) && (!from || day >= from) && (!to || day <= to);
    });

    return of(requests.map((request) => ({ ...request }))).pipe(delay(400));
  }

  createRequest(payload: CreateRequestPayload): Observable<Request> {
    const request: Request = {
      ...payload,
      id: crypto.randomUUID(),
      estado: 'INGRESADO',
      fechaCreacion: new Date().toISOString(),
      // En la API real el solicitante sale del token; el mock usa la cuenta activa
      solicitanteId: this.auth.userId() ?? '',
    };
    this.mockData = [...this.mockData, request];

    return of({ ...request }).pipe(delay(400));
  }
}
