import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { MqAdminService } from '../../../core/mq/mq-admin.service';
import { MqQueue } from '../../../core/mq/mq-admin.models';
import { ProcedureType } from '../../../shared/models/procedure-type.model';
import { HomeAttentionComponent } from './home-attention.component';

const type = (label: string, overrides: Partial<ProcedureType> = {}): ProcedureType => ({
  value: label.toLowerCase(),
  label,
  active: true,
  dailyQuota: 10,
  remainingQuota: 4,
  slaBusinessDays: null,
  ...overrides,
});

const queue = (name: string, messages: number): MqQueue => ({
  name,
  messages,
  consumers: 0,
  durable: true,
  ttl: null,
  deadLetterExchange: null,
  deadLetterRoutingKey: null,
});

describe('HomeAttentionComponent', () => {
  let fixture: ComponentFixture<HomeAttentionComponent>;
  let element: HTMLElement;
  let getProcedures: ReturnType<typeof vi.fn>;

  const render = async (
    catalog: () => Observable<ProcedureType[]>,
    queues: () => Observable<MqQueue[]>,
  ) => {
    getProcedures = vi.fn(catalog);
    await TestBed.configureTestingModule({
      imports: [HomeAttentionComponent],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: { getProcedures } },
        { provide: MqAdminService, useValue: { listQueues: vi.fn(queues) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeAttentionComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };
  const items = () =>
    Array.from(element.querySelectorAll('.attention__text'), (item) => item.textContent?.trim());

  it('no se muestra si no hay nada que atender', async () => {
    await render(
      () => of([type('Bache en calle'), type('Ruido', { dailyQuota: null, remainingQuota: null })]),
      () => of([queue('q.cmd.email', 3), queue('q.cmd.email.dlq', 0)]),
    );
    expect(element.querySelector('section')).toBeNull();
  });

  it('avisa los tipos activos sin cupo y los mensajes en DLQ, con enlace a la sección filtrada', async () => {
    await render(
      () =>
        of([
          type('Bache en calle', { remainingQuota: 0 }),
          type('Histórico', { active: false, remainingQuota: 0 }),
        ]),
      () => of([queue('q.cmd.email.dlq', 2), queue('q.cmd.crew.dlq', 1), queue('q.cmd.email', 9)]),
    );
    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Requiere atención');
    expect(items()).toEqual([
      'Bache en calle agotó su cupo diario.',
      '3 mensajes sin procesar en 2 DLQ de RabbitMQ.',
    ]);
    const links = Array.from(element.querySelectorAll('a'), (link) => link.getAttribute('href'));
    expect(links).toEqual([
      '/administracion?seccion=catalogo',
      '/administracion?seccion=rabbitmq&mostrar=dlq',
    ]);
    expect(element.querySelector('.attention__item--error')).not.toBeNull();
  });

  it('nombra hasta tres tipos y resume el resto, en singular o plural', async () => {
    await render(
      () => of(['A', 'B', 'C', 'D', 'E'].map((label) => type(label, { remainingQuota: 0 }))),
      () => of([queue('q.cmd.email.dlq', 1)]),
    );
    expect(items()).toEqual([
      '5 tipos agotaron su cupo diario: A, B, C y 2 más.',
      '1 mensaje sin procesar en una DLQ de RabbitMQ.',
    ]);
  });

  it('si una fuente falla lo dice y permite reintentar solo esa fuente', async () => {
    await render(
      () => throwError(() => new HttpErrorResponse({ status: 503 })),
      () => of([]),
    );
    expect(items()).toEqual(['No pudimos revisar los cupos del catálogo.']);
    getProcedures.mockReturnValue(of([type('Bache en calle')]));
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(getProcedures).toHaveBeenCalledTimes(2);
    expect(element.querySelector('section')).toBeNull();
  });
});
