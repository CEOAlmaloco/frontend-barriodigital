import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { MqQueue } from './mq-admin.models';

/** Administración de RabbitMQ a través del BFF (solo Admin). */
@Injectable({ providedIn: 'root' })
export class MqAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.bffBaseUrl}/api/mq/queues`;

  listQueues(): Observable<MqQueue[]> {
    return this.http.get<MqQueue[]>(this.url);
  }

  getQueue(name: string): Observable<MqQueue> {
    return this.http.get<MqQueue>(`${this.url}/${encodeURIComponent(name)}`);
  }

  /** Vacía los mensajes de la cola (204). */
  purgeQueue(name: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(name)}/messages`);
  }

  /** Elimina la cola (204). */
  deleteQueue(name: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(name)}`);
  }
}
