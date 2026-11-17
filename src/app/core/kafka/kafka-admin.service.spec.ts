import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { KafkaAdminService } from './kafka-admin.service';

describe('KafkaAdminService', () => {
  const base = `${environment.bffBaseUrl}/api/kafka`;
  let service: KafkaAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(KafkaAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista tópicos, grupos y solicita replay de DLT', async () => {
    const topics = firstValueFrom(service.listTopics());
    http.expectOne(`${base}/topics`).flush([
      { name: 'requests.events', partitions: 3, replicationFactor: 1, system: true },
    ]);
    expect((await topics)[0].name).toBe('requests.events');

    const groups = firstValueFrom(service.listConsumerGroups());
    http.expectOne(`${base}/consumer-groups`).flush([
      { groupId: 'report-group', state: 'STABLE', members: 1, system: true },
    ]);
    expect((await groups)[0].groupId).toBe('report-group');

    const replay = firstValueFrom(
      service.replayDlt('requests.events.DLT', { offsets: [{ partition: 0, offset: 1 }] }),
    );
    const call = http.expectOne(`${base}/dlt/requests.events.DLT/replay`);
    expect(call.request.method).toBe('POST');
    call.flush({
      dlt: 'requests.events.DLT',
      targetTopic: 'requests.events',
      resent: 1,
      skipped: 0,
      failed: 0,
      notAttempted: 0,
    });
    expect((await replay).resent).toBe(1);
  });
});
