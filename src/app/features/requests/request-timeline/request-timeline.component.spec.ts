import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestCommentPhotoComponent } from '../request-comment-photo/request-comment-photo.component';
import { RequestActivityEvent } from '../requests.service';
import { RequestTimelineComponent } from './request-timeline.component';

@Component({ selector: 'app-request-comment-photo', template: '' })
class PhotoStubComponent {
  readonly requestId = input('');
  readonly commentId = input('');
  readonly context = input('');
}

const event = (overrides: Partial<RequestActivityEvent>): RequestActivityEvent => ({
  id: 'ev',
  occurredAt: '2026-11-12T11:03:00.000Z',
  kind: 'CREADO',
  visibility: 'PUBLICO',
  actorId: 'oid-vecina',
  actorName: 'María José Fuentes',
  actorRole: 'Vecino',
  summary: 'Trámite ingresado',
  fromStatus: null,
  toStatus: 'INGRESADO',
  reason: null,
  channel: null,
  result: null,
  note: null,
  nextAttemptAt: null,
  ...overrides,
});

const comment = (overrides: Partial<RequestActivityEvent> = {}) =>
  event({
    id: 'comentario',
    kind: 'COMENTARIO',
    toStatus: null,
    summary: 'Agregó un comentario con una foto',
    note: 'El bache creció.\nAhora se junta agua.',
    hasAttachment: true,
    ...overrides,
  });

describe('RequestTimelineComponent', () => {
  let fixture: ComponentFixture<RequestTimelineComponent>;
  let element: HTMLElement;

  const render = async (
    events: RequestActivityEvent[],
    { staff = false, requestId = 'req-1' as string | null } = {},
  ) => {
    TestBed.configureTestingModule({ imports: [RequestTimelineComponent] });
    TestBed.overrideComponent(RequestTimelineComponent, {
      remove: { imports: [RequestCommentPhotoComponent] },
      add: { imports: [PhotoStubComponent] },
    });
    fixture = TestBed.createComponent(RequestTimelineComponent);
    fixture.componentRef.setInput('events', events);
    fixture.componentRef.setInput('staff', staff);
    fixture.componentRef.setInput('requestId', requestId);
    element = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const photo = () =>
    fixture.debugElement.query((node) => node.name === 'app-request-comment-photo');

  it('un comentario muestra su texto, el ícono del vecino y la foto con autor y hora', async () => {
    await render([event({ id: 'creado' }), comment()]);

    const item = element.querySelector('.timeline__event')!;
    expect(item.classList).toContain('timeline__event--primary');
    expect(item.querySelector('mat-icon')?.textContent).toBe('chat');
    expect(item.querySelector('.timeline__summary')?.textContent?.trim()).toBe(
      'Agregó un comentario con una foto',
    );
    expect(item.querySelector('.timeline__note')?.textContent).toBe(
      'El bache creció.\nAhora se junta agua.',
    );
    const stub = photo().componentInstance as PhotoStubComponent;
    expect(stub.requestId()).toBe('req-1');
    expect(stub.commentId()).toBe('comentario');
    expect(stub.context()).toMatch(/^María José Fuentes, \d{2}\/11\/2026 \d{2}:\d{2}$/);
  });

  it('sin foto, o sin el id del trámite, no pide imagen', async () => {
    await render([comment({ hasAttachment: false, summary: 'Agregó un comentario' })]);
    expect(photo()).toBeNull();

    TestBed.resetTestingModule();
    await render([comment()], { requestId: null });
    expect(photo()).toBeNull();
  });

  it('el staff puede filtrar los comentarios', async () => {
    await render(
      [
        event({ id: 'creado' }),
        event({ id: 'estado', kind: 'ESTADO', fromStatus: 'INGRESADO', toStatus: 'ADMITIDO' }),
        comment(),
      ],
      { staff: true },
    );
    const filter = [...element.querySelectorAll<HTMLButtonElement>('.timeline__filter')].find(
      (button) => button.textContent?.trim() === 'Comentarios',
    )!;
    filter.click();
    fixture.detectChanges();

    const items = element.querySelectorAll('.timeline__event');
    expect(items).toHaveLength(1);
    expect(items[0].querySelector('mat-icon')?.textContent).toBe('chat');
    expect(filter.getAttribute('aria-pressed')).toBe('true');
  });

  it('el Vecino no ve filtros', async () => {
    await render([event({ id: 'creado' }), comment()]);
    expect(element.querySelector('.timeline__filters')).toBeNull();
  });
});
