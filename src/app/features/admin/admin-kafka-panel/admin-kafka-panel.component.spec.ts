import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, of, throwError } from 'rxjs';

import { KafkaAdminService } from '../../../core/kafka/kafka-admin.service';
import type {
  KafkaDltMessage,
  KafkaGroupDetail,
  KafkaTopicDetail,
} from '../../../core/kafka/kafka-admin.models';
import { AdminKafkaPanelComponent } from './admin-kafka-panel.component';

const topicDetail = (name: string, isr: number[][] = [[1, 2, 3]]): KafkaTopicDetail => ({
  name,
  system: true,
  partitions: isr.map((members, partition) => ({
    partition,
    leader: 1,
    replicas: [1, 2, 3],
    isr: members,
  })),
  configs: [],
});

const groupDetail = (
  groupId: string,
  lags: (number | null)[],
  members = 0,
  system = true,
): KafkaGroupDetail => ({
  groupId,
  state: members ? 'STABLE' : 'EMPTY',
  members,
  system,
  topics: [
    {
      topic: 'requests.events',
      partitions: lags.map((lag, partition) => ({
        partition,
        committedOffset: lag === null ? null : 10,
        endOffset: 10 + (lag ?? 0),
        lag,
        lagBasis: lag === null ? null : 'COMMITTED',
      })),
    },
  ],
});

const dltMessage = (offset: number): KafkaDltMessage => ({
  partition: 0,
  offset,
  key: null,
  receivedAt: '2026-11-20T15:00:00Z',
  eventId: `evento-${offset}`,
  eventType: null,
  value: '{"eventId":"x"}',
  originalTopic: 'requests.events',
  originalPartition: 0,
  originalOffset: 40 + offset,
  originalTimestamp: null,
  consumerGroup: 'report-group',
  exceptionClass: 'NonRetryableEventException',
  exceptionCause: null,
  exceptionMessage: 'Sobre invalido: falta eventType',
});

describe('AdminKafkaPanelComponent', () => {
  let fixture: ComponentFixture<AdminKafkaPanelComponent>;
  let element: HTMLElement;
  type ServiceKey =
    | 'listTopics'
    | 'getTopic'
    | 'listConsumerGroups'
    | 'getConsumerGroup'
    | 'resetOffsets'
    | 'listDltMessages'
    | 'replayDlt'
    | 'deleteTopic';
  let service: Record<ServiceKey, ReturnType<typeof vi.fn>>;

  const render = async (overrides: Partial<Record<ServiceKey, ReturnType<typeof vi.fn>>> = {}) => {
    service = {
      listTopics: vi.fn(() =>
        of([
          { name: 'requests.events', partitions: 3, replicationFactor: 3, system: true },
          { name: 'audit.timeline', partitions: 3, replicationFactor: 3, system: true },
          { name: 'pruebas.carga', partitions: 1, replicationFactor: 3, system: false },
          { name: 'requests.events.report.DLT', partitions: 3, replicationFactor: 3, system: true },
        ]),
      ),
      getTopic: vi.fn((name: string) =>
        of(name === 'audit.timeline' ? topicDetail(name, [[1, 2]]) : topicDetail(name)),
      ),
      listConsumerGroups: vi.fn(() =>
        of([
          { groupId: 'report-group', state: 'STABLE', members: 1, system: true },
          { groupId: 'audit-group', state: 'EMPTY', members: 0, system: true },
          { groupId: 'nuevo-grupo', state: 'EMPTY', members: 0, system: false },
        ]),
      ),
      getConsumerGroup: vi.fn((groupId: string) =>
        of(
          groupId === 'report-group'
            ? groupDetail(groupId, [5, 0, 2], 1)
            : groupId === 'audit-group'
              ? groupDetail(groupId, [0, 0, 0])
              : groupDetail(groupId, [null, null, null], 0, false),
        ),
      ),
      resetOffsets: vi.fn((groupId: string, body: { topic: string; dryRun: boolean }) =>
        of({
          groupId,
          topic: body.topic,
          strategy: 'EARLIEST',
          dryRun: body.dryRun,
          partitions: [{ partition: 0, currentOffset: 10, targetOffset: 0, lagAfter: 10 }],
        }),
      ),
      listDltMessages: vi.fn(() =>
        of({
          dlt: 'requests.events.report.DLT',
          partitions: [
            { partition: 0, nextOffset: null, messages: [dltMessage(1), dltMessage(2)] },
          ],
        }),
      ),
      replayDlt: vi.fn(() =>
        of({
          dlt: 'x',
          targetTopic: 'requests.events',
          resent: 2,
          skipped: 0,
          failed: 0,
          notAttempted: 0,
        }),
      ),
      deleteTopic: vi.fn(() => of(void 0)),
      ...overrides,
    };
    await TestBed.configureTestingModule({
      imports: [AdminKafkaPanelComponent],
      providers: [
        { provide: KafkaAdminService, useValue: service },
        {
          provide: MAT_DIALOG_DEFAULT_OPTIONS,
          useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminKafkaPanelComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };
  const text = () => element.textContent ?? '';
  const overlay = () => TestBed.inject(OverlayContainer).getContainerElement();
  const kpi = (label: string) =>
    Array.from(element.querySelectorAll('[app-admin-kpi]'))
      .find((tile) => tile.querySelector('dt')?.lastChild?.textContent?.trim() === label)!
      .querySelector('dd')!
      .textContent!.trim();
  const button = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.trim() === label,
    )!;
  const cells = (column: string) =>
    Array.from(element.querySelectorAll(`.admin-section__table td.mat-column-${column}`), (cell) =>
      cell.textContent?.replace(/\s+/g, ' ').trim(),
    );
  const showView = async (label: string) => {
    button(element, label).click();
    await fixture.whenStable();
  };
  const waitDialogClose = () =>
    firstValueFrom(TestBed.inject(MatDialog).openDialogs.at(-1)!.afterClosed());

  afterEach(async () => {
    const dialog = TestBed.inject(MatDialog);
    const closed = dialog.openDialogs.map((ref) => firstValueFrom(ref.afterClosed()));
    dialog.closeAll();
    await Promise.all(closed);
  });

  it('resume tópicos sin contar las DLT y calcula réplicas y retraso de todos los grupos, también los del sistema', async () => {
    await render();
    expect(kpi('Tópicos')).toBe('3');
    expect(kpi('Particiones')).toBe('7');
    expect(kpi('Tópicos con réplicas incompletas')).toBe('1');
    expect(kpi('Grupos de consumo')).toBe('3');
    expect(kpi('Grupos con retraso')).toBe('1');
    expect(service.getConsumerGroup).toHaveBeenCalledWith('report-group');
    expect(service.getConsumerGroup).toHaveBeenCalledWith('audit-group');
    expect(cells('health')).toEqual([
      'Sincronizadas',
      'Incompletas',
      'Sincronizadas',
      'Sincronizadas',
    ]);
  });

  it('muestra "Sin offset" cuando kafka-admin no conoce el retraso, en vez de 0', async () => {
    await render();
    await showView('Grupos de consumo');
    expect(cells('lag')).toEqual(['7', '0', 'Sin offset']);
    expect(cells('state')).toEqual(['Estable', 'Sin miembros', 'Sin miembros']);
  });

  it('si falla el detalle de un tópico lo marca "No disponible" y no queda consultando', async () => {
    await render({ getTopic: vi.fn(() => throwError(() => new Error('sin red'))) });
    expect(cells('health')).toEqual([
      'No disponible',
      'No disponible',
      'No disponible',
      'No disponible',
    ]);
    expect(kpi('Tópicos con réplicas incompletas')).toBe('0');
  });

  it('solo ofrece eliminar tópicos que no son del sistema', async () => {
    await render();
    const menus = Array.from(
      element.querySelectorAll('.admin-section__table button[aria-label^="Más acciones"]'),
      (item) => item.getAttribute('aria-label'),
    );
    expect(menus).toEqual(['Más acciones para pruebas.carga']);
  });

  it('sin tópicos muestra el error de carga', async () => {
    await render({ listTopics: vi.fn(() => throwError(() => new Error('sin red'))) });
    expect(text()).toContain('No pudimos cargar los tópicos de Kafka');
    expect(element.querySelector('.admin-ops-kpis')).toBeNull();
  });

  it('reenvía desde la DLT los mensajes seleccionados, después de confirmar', async () => {
    await render();
    await showView('DLT');
    expect(service.listDltMessages).toHaveBeenCalledWith('requests.events.report.DLT', {
      limit: 50,
    });
    expect(cells('error')).toEqual([
      'Sobre invalido: falta eventType',
      'Sobre invalido: falta eventType',
    ]);
    const replay = () =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((item) =>
        item.textContent?.includes('Reenviar seleccionados'),
      )!;
    expect(replay().textContent).toContain('(0)');
    expect(replay().disabled).toBe(true);
    element.querySelector<HTMLInputElement>('.admin-section__table th mat-checkbox input')!.click();
    await fixture.whenStable();
    expect(replay().disabled).toBe(false);
    expect(replay().textContent).toContain('(2)');
    replay().click();
    await fixture.whenStable();
    expect(overlay().textContent).toContain('Se reenviarán 2 mensajes');
    const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const closed = waitDialogClose();
    button(overlay(), 'Reenviar').click();
    await closed;
    await fixture.whenStable();
    expect(service.replayDlt).toHaveBeenCalledWith('requests.events.report.DLT', {
      offsets: [
        { partition: 0, offset: 1 },
        { partition: 0, offset: 2 },
      ],
    });
    expect(snack).toHaveBeenCalledWith('Reenvío: 2 reenviados.', 'Cerrar', { duration: 6000 });
  });

  it('distingue una DLT vacía de una que no se pudo leer', async () => {
    await render({
      listDltMessages: vi.fn(() =>
        of({
          dlt: 'requests.events.report.DLT',
          partitions: [{ partition: 0, nextOffset: null, messages: [] }],
        }),
      ),
    });
    await showView('DLT');
    expect(text()).toContain('No hay mensajes en esta DLT');
    service.listDltMessages.mockReturnValue(throwError(() => new Error('sin red')));
    fixture.componentInstance['selectDlt']('requests.events.report.DLT');
    await fixture.whenStable();
    expect(text()).toContain('No pudimos leer los mensajes de esta DLT');
  });

  it('no permite reiniciar offsets con miembros conectados', async () => {
    await render();
    await showView('Grupos de consumo');
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Ver detalle de report-group"]',
      )!
      .click();
    await fixture.whenStable();
    const dialog = overlay().querySelector('mat-dialog-container')!;
    expect(dialog.textContent).toContain('El grupo tiene 1 miembro conectado.');
    expect(button(dialog, 'Simular')).toBeUndefined();
  });

  it('reinicia offsets solo después de simular y confirmar', async () => {
    await render();
    await showView('Grupos de consumo');
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Ver detalle de audit-group"]',
      )!
      .click();
    await fixture.whenStable();
    const dialog = overlay().querySelector('mat-dialog-container')!;
    expect(button(dialog, 'Reiniciar offsets').disabled).toBe(true);
    button(dialog, 'Simular').click();
    await fixture.whenStable();
    expect(service.resetOffsets).toHaveBeenCalledWith('audit-group', {
      topic: 'requests.events',
      strategy: 'EARLIEST',
      dryRun: true,
    });
    expect(dialog.querySelector('caption')?.textContent).toContain('requests.events');
    button(dialog, 'Reiniciar offsets').click();
    await fixture.whenStable();
    const closed = waitDialogClose();
    button(overlay(), 'Reiniciar').click();
    await closed;
    await fixture.whenStable();
    expect(service.resetOffsets).toHaveBeenLastCalledWith('audit-group', {
      topic: 'requests.events',
      strategy: 'EARLIEST',
      dryRun: false,
    });
  });

  it('muestra el motivo que devuelve kafka-admin en un 409', async () => {
    await render({
      resetOffsets: vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: 'El reset adelantaria offsets en las particiones 0, 2' },
            }),
        ),
      ),
    });
    const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    await showView('Grupos de consumo');
    element
      .querySelector<HTMLButtonElement>(
        '.admin-section__table button[aria-label="Ver detalle de audit-group"]',
      )!
      .click();
    await fixture.whenStable();
    button(overlay().querySelector('mat-dialog-container')!, 'Simular').click();
    await fixture.whenStable();
    expect(snack).toHaveBeenCalledWith(
      'El reset adelantaria offsets en las particiones 0, 2',
      'Cerrar',
      { duration: 6000 },
    );
  });
});
