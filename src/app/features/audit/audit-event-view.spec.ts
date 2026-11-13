import { AuditEvent } from '../../shared/models/audit.model';
import { configChange, formatValue, toAuditEventView } from './audit-event-view';

const admin = { id: 'a1', name: 'Carolina Muñoz', role: 'Admin', sourceIp: null };

const event = (overrides: Partial<AuditEvent>): AuditEvent => ({
  eventId: 'e1',
  eventType: 'request.created',
  occurredAt: '2026-11-13T19:42:08Z',
  producer: 'requests',
  actor: admin,
  resourceType: 'request',
  resourceId: '7b6e1d44-2a18-4c90-9f01-88aa11bb22cc',
  requestId: '7b6e1d44-2a18-4c90-9f01-88aa11bb22cc',
  folio: 'BD-2026-000412',
  sequence: 10,
  summary: 'Alta del tramite BD-2026-000412',
  details: {},
  ...overrides,
});

describe('toAuditEventView', () => {
  it('muestra la fecha en hora de Chile y el rol con su nombre en la interfaz', () => {
    const view = toAuditEventView(event({}));
    expect(view.date).toBe('13/11/2026');
    expect(view.time).toBe('16:42:08');
    expect(view.actorName).toBe('Carolina Muñoz');
    expect(view.actorRole).toBe('Administrador');
  });

  it('arma el ingreso con tipo, sector y plazo', () => {
    const view = toAuditEventView(
      event({ details: { procedureLabel: 'Bache en calle', sector: 'ralco', slaBusinessDays: 5 } }),
    );
    expect(view.title).toBe('Ingreso del trámite');
    expect(view.fields).toEqual([
      { label: 'Tipo', value: 'Bache en calle' },
      { label: 'Sector', value: 'Ralco' },
      { label: 'Plazo', value: '5 días hábiles' },
    ]);
  });

  it('distingue un tipo sin plazo de un evento antiguo que no traía el dato', () => {
    const noSla = toAuditEventView(
      event({ details: { procedureType: 'bache', slaBusinessDays: null } }),
    );
    expect(noSla.fields).toContainEqual({ label: 'Plazo', value: 'Sin plazo' });
    const old = toAuditEventView(event({ details: { procedureType: 'bache' } }));
    expect(old.fields.map((field) => field.label)).toEqual(['Tipo']);
  });

  it('arma un rechazo con la transición, el motivo y la intervención del Administrador', () => {
    const view = toAuditEventView(
      event({
        eventType: 'request.status-changed',
        details: {
          fromStatus: 'ADMITIDO',
          toStatus: 'RECHAZADO',
          reason: 'Fuera de la comuna',
          interventionReason: 'Funcionario con licencia',
        },
      }),
    );
    expect(view.headline).toBe('Cambio de estado: Admitido → Rechazado');
    expect(view.transition).toEqual({ from: 'ADMITIDO', to: 'RECHAZADO' });
    expect(view.tone).toBe('error');
    expect(view.fields).toContainEqual({ label: 'Motivo de rechazo', value: 'Fuera de la comuna' });
    expect(view.interventionReason).toBe('Funcionario con licencia');
  });

  it('distingue asignación y reasignación', () => {
    const first = toAuditEventView(
      event({
        eventType: 'request.assigned',
        details: { assigneeName: 'Javier Antilef', previousAssigneeId: null },
      }),
    );
    expect(first.title).toBe('Asignación');
    const again = toAuditEventView(
      event({
        eventType: 'request.assigned',
        details: {
          assigneeName: 'Javier Antilef',
          previousAssigneeId: 'f2',
          reason: 'Carga del sector',
        },
      }),
    );
    expect(again.title).toBe('Reasignación');
    expect(again.fields).toContainEqual({ label: 'Motivo', value: 'Carga del sector' });
  });

  it('traduce canal y resultado de una gestión, y conserva un código desconocido', () => {
    const view = toAuditEventView(
      event({
        eventType: 'request.contact-logged',
        details: { channel: 'LLAMADA', result: 'NUEVO_RESULTADO' },
      }),
    );
    expect(view.fields).toEqual([
      { label: 'Canal', value: 'Llamada' },
      { label: 'Resultado', value: 'NUEVO_RESULTADO' },
    ]);
  });

  it('la IP no aplica a un trámite y se marca como no registrada en configuración', () => {
    expect(toAuditEventView(event({})).ipNote).toBe('No aplica');
    const config = toAuditEventView(
      event({ eventType: 'queue.purged', resourceType: 'queue', requestId: null, folio: null }),
    );
    expect(config.ip).toBeNull();
    expect(config.ipNote).toBe('No registrada');
    const withIp = toAuditEventView(
      event({
        eventType: 'queue.purged',
        resourceType: 'queue',
        actor: { ...admin, sourceIp: '190.161.34.12' },
      }),
    );
    expect(withIp.ip).toBe('190.161.34.12');
  });

  it('tolera un evento histórico sin actor, sin folio, sin resourceType ni details', () => {
    const view = toAuditEventView(
      event({
        actor: null,
        folio: null,
        resourceType: undefined,
        details: undefined,
        occurredAt: 'x',
      }),
    );
    expect(view.kind).toBe('request');
    expect(view.actorName).toBe('Sin nombre');
    expect(view.actorRole).toBe('Rol no registrado');
    expect(view.folio).toBeNull();
    expect(view.date).toBe('Fecha no registrada');
    expect(view.fields).toEqual([]);
  });

  it('un tipo de evento desconocido usa el resumen de audit', () => {
    const view = toAuditEventView(
      event({ eventType: 'request.reopened', summary: 'Reapertura del tramite' }),
    );
    expect(view.unknown).toBe(true);
    expect(view.title).toBe('Reapertura del tramite');
  });
});

describe('configChange', () => {
  it('en una edición marca solo los campos que cambiaron', () => {
    const change = configChange('procedure-type.updated', {
      before: { label: 'Bache', dailyQuota: 20, slaBusinessDays: null },
      after: { label: 'Bache', dailyQuota: 15, slaBusinessDays: 5 },
    });
    expect(change?.mode).toBe('update');
    expect(change?.rows).toEqual([
      { field: 'Nombre', before: 'Bache', after: 'Bache', changed: false },
      { field: 'Cupo diario', before: '20', after: '15', changed: true },
      { field: 'Plazo (días hábiles)', before: 'Sin valor', after: '5', changed: true },
    ]);
  });

  it('reconoce alta, eliminación y resultado de una operación', () => {
    expect(configChange('topic.created', { before: null, after: { partitions: 3 } })?.mode).toBe(
      'create',
    );
    expect(configChange('queue.deleted', { before: { durable: true }, after: null })?.mode).toBe(
      'delete',
    );
    const purge = configChange('queue.purged', {
      before: { messages: 12 },
      after: { messagesRemoved: 12 },
    });
    expect(purge?.mode).toBe('result');
    expect(purge?.rows.every((row) => !row.changed)).toBe(true);
  });

  it('un campo nuevo en after aparece sin valor anterior, y sin before ni after no hay tabla', () => {
    const change = configChange('procedure-type.updated', {
      before: { label: 'A' },
      after: { label: 'A', color: 'rojo' },
    });
    expect(change?.rows.at(-1)).toEqual({
      field: 'color',
      before: null,
      after: 'rojo',
      changed: true,
    });
    expect(configChange('procedure-type.updated', { before: null, after: null })).toBeNull();
    expect(configChange('procedure-type.updated', null)).toBeNull();
  });

  it('formatea booleanos, números y objetos', () => {
    expect(formatValue(true)).toBe('Sí');
    expect(formatValue(1200)).toBe('1.200');
    expect(formatValue([{ partition: 0, offset: 4 }])).toBe('[{"partition":0,"offset":4}]');
  });
});
