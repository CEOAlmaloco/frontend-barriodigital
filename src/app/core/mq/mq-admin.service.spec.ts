import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MqAdminService } from './mq-admin.service';

describe('MqAdminService', () => {
  const url = `${environment.bffBaseUrl}/api/mq/queues`;
  let service: MqAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MqAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista colas y purga mensajes', async () => {
    const list = firstValueFrom(service.listQueues());
    const get = http.expectOne(url);
    expect(get.request.method).toBe('GET');
    get.flush([{ name: 'q.cmd.email', messages: 2, consumers: 1, durable: true, ttl: null, deadLetterExchange: null, deadLetterRoutingKey: null }]);
    expect(await list).toHaveLength(1);

    const purge = firstValueFrom(service.purgeQueue('q.cmd.email'));
    const del = http.expectOne(`${url}/q.cmd.email/messages`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await purge;
  });
});
