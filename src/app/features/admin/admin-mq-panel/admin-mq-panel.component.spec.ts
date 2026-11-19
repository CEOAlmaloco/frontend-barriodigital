import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { MqAdminService } from '../../../core/mq/mq-admin.service';
import { AdminMqPanelComponent } from './admin-mq-panel.component';

describe('AdminMqPanelComponent', () => {
  it('lista colas y exige confirmación antes de vaciar', async () => {
    const listQueues = vi.fn(() =>
      of([
        {
          name: 'q.cmd.email.dead',
          messages: 3,
          messagesReady: 3,
          messagesUnacked: 0,
          consumers: 0,
          durable: true,
          ttl: null,
          deadLetterExchange: null,
          deadLetterRoutingKey: null,
        },
      ]),
    );
    const purgeQueue = vi.fn(() => of(void 0));
    const afterClosed = of(true);

    await TestBed.configureTestingModule({
      imports: [AdminMqPanelComponent],
      providers: [
        {
          provide: MqAdminService,
          useValue: { listQueues, getQueue: vi.fn(), purgeQueue, deleteQueue: vi.fn() },
        },
        {
          provide: MatDialog,
          useValue: { open: vi.fn(() => ({ afterClosed: () => afterClosed })) },
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminMqPanelComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(listQueues).toHaveBeenCalled();
    expect(element.textContent).toContain('q.cmd.email.dead');
    expect(element.textContent).toContain('DLQ');

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Vaciar'))
      ?.click();
    await fixture.whenStable();

    expect(TestBed.inject(MatDialog).open).toHaveBeenCalled();
    expect(purgeQueue).toHaveBeenCalledWith('q.cmd.email.dead');
  });
});
