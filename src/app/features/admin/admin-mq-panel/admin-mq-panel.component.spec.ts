import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';

import { MqAdminService } from '../../../core/mq/mq-admin.service';
import { MqQueue } from '../../../core/mq/mq-admin.models';
import { AdminMqPanelComponent } from './admin-mq-panel.component';

const queue = (name: string, overrides: Partial<MqQueue> = {}): MqQueue => ({
  name,
  messages: 0,
  messagesReady: 0,
  messagesUnacked: 0,
  consumers: 1,
  durable: true,
  ttl: null,
  deadLetterExchange: null,
  deadLetterRoutingKey: null,
  ...overrides,
});

describe('AdminMqPanelComponent', () => {
  const queues: MqQueue[] = [
    queue('q.cmd.email', {
      deadLetterExchange: 'cmd.dead.dlx',
      deadLetterRoutingKey: 'email.dead',
    }),
    queue('q.cmd.email.dlq', { messages: 2, messagesReady: 2, consumers: 0 }),
    queue('q.demo.avisos', { messages: 4, messagesReady: 3, messagesUnacked: 1, consumers: 0 }),
  ];
  let fixture: ComponentFixture<AdminMqPanelComponent>;
  let element: HTMLElement;
  let service: Record<
    'listQueues' | 'getQueue' | 'purgeQueue' | 'deleteQueue',
    ReturnType<typeof vi.fn>
  >;

  const render = async (listQueues: () => unknown = () => of(queues)) => {
    service = {
      listQueues: vi.fn(listQueues),
      getQueue: vi.fn((name: string) =>
        of({ ...queues.find((q) => q.name === name)!, publishRate: 1.5 }),
      ),
      purgeQueue: vi.fn(() => of(void 0)),
      deleteQueue: vi.fn(() => of(void 0)),
    };
    await TestBed.configureTestingModule({
      imports: [AdminMqPanelComponent],
      providers: [
        provideRouter([]),
        { provide: MqAdminService, useValue: service },
        {
          provide: MAT_DIALOG_DEFAULT_OPTIONS,
          useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminMqPanelComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };
  const text = () => element.textContent ?? '';
  const overlay = () => TestBed.inject(OverlayContainer).getContainerElement();
  const kpi = (label: string) =>
    Array.from(element.querySelectorAll('[app-admin-kpi]')).find(
      (tile) => tile.querySelector('dt')?.lastChild?.textContent?.trim() === label,
    )!;
  const tableNames = () =>
    Array.from(element.querySelectorAll('td.mat-column-name .admin-section__name'), (cell) =>
      cell.textContent?.trim(),
    );
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.trim() === label,
    )!;

  const menuItem = (label: string) =>
    Array.from(overlay().querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(
      (item) => item.querySelector('span')?.textContent?.trim() === label,
    )!;

  afterEach(async () => {
    const dialog = TestBed.inject(MatDialog);
    const closed = dialog.openDialogs.map((ref) => firstValueFrom(ref.afterClosed()));
    dialog.closeAll();
    await Promise.all(closed);
  });

  it('resume las colas: los mensajes en DLQ son error y una DLQ sin consumidor no cuenta como atascada', async () => {
    await render();
    expect(kpi('Colas').querySelector('dd')?.textContent?.trim()).toBe('3');
    expect(kpi('Mensajes en espera').querySelector('dd')?.textContent?.trim()).toBe('5');
    expect(kpi('Sin confirmar').querySelector('dd')?.textContent?.trim()).toBe('1');
    expect(kpi('Mensajes en DLQ').getAttribute('data-tone')).toBe('error');
    expect(text()).toContain('1 cola de trabajo tiene mensajes y ningún consumidor.');
    expect(text()).toContain('Actualizado a las');
    expect(service.listQueues).toHaveBeenCalledTimes(1);
  });

  it('no ofrece vaciar ni eliminar la topología del sistema', async () => {
    await render();
    const menus = Array.from(
      element.querySelectorAll<HTMLButtonElement>(
        '.admin-section__table button[aria-label^="Más acciones"]',
      ),
      (item) => item.getAttribute('aria-label'),
    );
    expect(menus).toEqual(['Más acciones para q.demo.avisos']);
    expect(element.querySelectorAll('.admin-section__table .admin-badge--primary')).toHaveLength(2);
  });

  it('vacía una cola solo después de confirmar y vuelve a consultar', async () => {
    await render();
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Más acciones para q.demo.avisos"]',
      )!
      .click();
    await fixture.whenStable();
    menuItem('Vaciar cola').click();
    await fixture.whenStable();
    expect(overlay().textContent).toContain('Se eliminarán 4 mensajes de «q.demo.avisos»');
    expect(service.purgeQueue).not.toHaveBeenCalled();
    const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const confirmed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    button(overlay(), 'Vaciar').click();
    await confirmed;
    await fixture.whenStable();
    expect(service.purgeQueue).toHaveBeenCalledWith('q.demo.avisos');
    expect(snack).toHaveBeenCalledWith('Cola «q.demo.avisos» vaciada.', 'Cerrar', {
      duration: 4000,
    });
    expect(service.listQueues).toHaveBeenCalledTimes(2);
  });

  it('cancelar la confirmación no elimina', async () => {
    await render();
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Más acciones para q.demo.avisos"]',
      )!
      .click();
    await fixture.whenStable();
    menuItem('Eliminar cola').click();
    await fixture.whenStable();
    expect(overlay().textContent).toContain('Se eliminará la cola «q.demo.avisos»');
    const cancelled = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    button(overlay(), 'Cancelar').click();
    expect(await cancelled).toBeFalsy();
    await fixture.whenStable();
    expect(service.deleteQueue).not.toHaveBeenCalled();
    expect(service.listQueues).toHaveBeenCalledTimes(1);
  });

  it('filtra por DLQ y por nombre, y ofrece limpiar cuando nada coincide', async () => {
    await render();
    button(element, 'DLQ').click();
    await fixture.whenStable();
    expect(tableNames()).toEqual(['q.cmd.email.dlq']);
    const search = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'avisos';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(text()).toContain('Ninguna cola coincide con la búsqueda o el filtro');
    button(element, 'Limpiar búsqueda y filtro').click();
    await fixture.whenStable();
    expect(tableNames()).toEqual(['q.cmd.email', 'q.cmd.email.dlq', 'q.demo.avisos']);
  });

  it('si falla la actualización conserva los datos, avisa y permite reintentar', async () => {
    await render();
    const retry = new Subject<MqQueue[]>();
    service.listQueues
      .mockReturnValueOnce(throwError(() => new Error('sin red')))
      .mockReturnValueOnce(retry);
    element.querySelector<HTMLButtonElement>('button[aria-label="Actualizar colas"]')!.click();
    await fixture.whenStable();
    expect(text()).toContain(
      'No pudimos actualizar las colas. Se muestran los últimos datos disponibles.',
    );
    expect(tableNames()).toHaveLength(3);
    button(element, 'Reintentar').click();
    retry.next([queues[0]]);
    retry.complete();
    await fixture.whenStable();
    expect(tableNames()).toEqual(['q.cmd.email']);
    expect(text()).not.toContain('No pudimos');
  });

  it('sin datos muestra el error de carga en vez de una lista vacía', async () => {
    await render(() => throwError(() => new Error('sin red')));
    expect(text()).toContain('No pudimos cargar las colas');
    expect(element.querySelector('.admin-ops-kpis')).toBeNull();
    expect(element.querySelector('button[aria-label="Actualizar colas"]')).toBeNull();
  });

  it('abre el detalle en un diálogo con los datos consultados', async () => {
    await render();
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Ver detalle de q.cmd.email"]',
      )!
      .click();
    await fixture.whenStable();
    const dialog = overlay().querySelector('mat-dialog-container')!;
    expect(dialog.querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe('q.cmd.email');
    expect(dialog.textContent).toContain('1,5 msg/s');
    expect(dialog.textContent).toContain('cmd.dead.dlx');
    expect(dialog.textContent).toContain('no se vacía ni se elimina');
    expect(service.getQueue).toHaveBeenCalledWith('q.cmd.email');
  });

  it('si el detalle falla mantiene los datos del listado y lo dice', async () => {
    await render();
    service.getQueue.mockReturnValue(throwError(() => new Error('sin red')));
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Ver detalle de q.demo.avisos"]',
      )!
      .click();
    await fixture.whenStable();
    const dialog = overlay().querySelector('mat-dialog-container')!;
    expect(dialog.textContent).toContain(
      'No pudimos consultar el detalle. Se muestran los datos del listado.',
    );
    expect(dialog.textContent).toContain('Sin TTL');
  });

  it('si mq-admin no envía el desglose no inventa ceros ni muestra NaN', async () => {
    await render(() =>
      of(
        queues.map(({ messagesReady, messagesUnacked, ...rest }) => ({
          ...rest,
          ...(rest.name === 'q.cmd.email' ? { messagesReady } : {}),
        })),
      ),
    );
    expect(text()).not.toContain('NaN');
    expect(kpi('Mensajes en espera').querySelector('dd')?.textContent?.trim()).toBe(
      'No disponible',
    );
    expect(kpi('Sin confirmar').querySelector('dd')?.textContent?.trim()).toBe('No disponible');
    const cells = Array.from(element.querySelectorAll('td.mat-column-unacked'), (cell) =>
      cell.textContent?.trim(),
    );
    expect(cells).toEqual(['—', '—', '—']);
  });

  it('con el servicio caído y sin datos explica la causa con un estado centrado', async () => {
    await render(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    const state = element.querySelector('app-admin-state')!;
    expect(state.getAttribute('role')).toBe('alert');
    expect(state.querySelector('h3')?.textContent?.trim()).toBe('RabbitMQ no está disponible');
  });

  it('toma el filtro de la URL y lo guarda al cambiarlo', async () => {
    await render();
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { mostrar: 'dlq' } });
    await fixture.whenStable();
    expect(tableNames()).toEqual(['q.cmd.email.dlq']);
    button(element, 'Con mensajes').click();
    await fixture.whenStable();
    expect(router.url).toBe('/?mostrar=con-mensajes');
    button(element, 'Todas').click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });
});
