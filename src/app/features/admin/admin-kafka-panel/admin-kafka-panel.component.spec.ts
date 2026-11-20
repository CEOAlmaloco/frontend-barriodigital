import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { KafkaAdminService } from '../../../core/kafka/kafka-admin.service';
import { AdminKafkaPanelComponent } from './admin-kafka-panel.component';

describe('AdminKafkaPanelComponent', () => {
  it('lista tópicos del sistema y DLT', async () => {
    const listTopics = vi.fn(() =>
      of([
        { name: 'requests.events', partitions: 3, replicationFactor: 1, system: true },
        { name: 'requests.events.DLT', partitions: 3, replicationFactor: 1, system: true },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [AdminKafkaPanelComponent],
      providers: [
        {
          provide: KafkaAdminService,
          useValue: {
            listTopics,
            getTopic: vi.fn(() => of(null)),
            listConsumerGroups: vi.fn(() => of([])),
            getConsumerGroup: vi.fn(() => of(null)),
            resetOffsets: vi.fn(),
            listDltMessages: vi.fn(() => of({ dlt: 'requests.events.DLT', partitions: [] })),
            replayDlt: vi.fn(),
            deleteTopic: vi.fn(),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminKafkaPanelComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(listTopics).toHaveBeenCalled();
    expect(element.textContent).toContain('requests.events');
    expect(element.textContent).toContain('Kafka');
    // Topics KPI excluye DLT; no debe quedar en 0 si hay tópicos de sistema.
    expect(element.textContent).toMatch(/Topics\s*1/);
    expect(element.textContent).toMatch(/Tópicos DLT\s*1/);
  });
});
