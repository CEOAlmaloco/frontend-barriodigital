import { activityText } from './activity-summary';
import { RequestActivityEvent } from './requests.service';

const event = (overrides: Partial<RequestActivityEvent>): RequestActivityEvent => ({
  id: 'ev',
  occurredAt: '2026-11-12T20:00:00.000Z',
  kind: 'CREADO',
  visibility: 'PUBLICO',
  actorId: 'oid-actor',
  actorName: 'Actor',
  summary: 'Solicitud recibida.',
  fromStatus: null,
  toStatus: null,
  reason: null,
  channel: null,
  result: null,
  note: null,
  nextAttemptAt: null,
  ...overrides,
});

describe('activityText', () => {
  it('gestión: canal y resultado separados por un punto medio', () => {
    expect(
      activityText(
        event({
          kind: 'GESTION',
          channel: 'CORREO',
          result: 'NO_CONTESTA',
          summary: 'Correo. Resultado: No contesta.',
        }),
      ),
    ).toEqual({ title: 'Correo · No contesta', reason: null });
  });

  it('estado: transición sin punto final y el motivo del rechazo aparte', () => {
    expect(
      activityText(event({ kind: 'ESTADO', fromStatus: 'INGRESADO', toStatus: 'ADMITIDO' })),
    ).toEqual({
      title: 'Pasó de Ingresado a Admitido',
      reason: null,
    });
    expect(
      activityText(
        event({
          kind: 'ESTADO',
          fromStatus: 'ADMITIDO',
          toStatus: 'RECHAZADO',
          reason: ' Duplicado ',
        }),
      ),
    ).toEqual({ title: 'Pasó de Admitido a Rechazado', reason: 'Duplicado' });
  });

  it('asignación: toma, asignación y reasignación con su motivo', () => {
    const base = { kind: 'ASIGNACION' as const, assigneeId: 'oid-ana', assigneeName: 'Ana' };
    expect(activityText(event({ ...base, actorId: 'oid-ana' })).title).toBe('Tomó el trámite');
    expect(activityText(event({ ...base, actorId: 'oid-admin' })).title).toBe('Asignó a Ana');
    expect(
      activityText(event({ ...base, previousAssigneeName: 'Luis', reason: 'Licencia médica' })),
    ).toEqual({ title: 'Reasignó de Luis a Ana', reason: 'Licencia médica' });
  });

  it('sin datos estructurados usa el summary del backend sin el punto final', () => {
    expect(activityText(event({})).title).toBe('Solicitud recibida');
    expect(
      activityText(
        event({
          kind: 'ASIGNACION',
          actorId: null,
          summary: 'Tu solicitud fue asignada para su atención',
        }),
      ).title,
    ).toBe('Tu solicitud fue asignada para su atención');
    expect(
      activityText(event({ kind: 'GESTION', channel: 'OTRO', summary: 'Llamada: No contesta.' }))
        .title,
    ).toBe('Llamada: No contesta');
  });
});
