import { HttpErrorResponse } from '@angular/common/http';

import { assignmentFailure } from './assignment-errors';

const httpError = (status: number, message?: string) =>
  new HttpErrorResponse({ status, error: message ? { message } : null });

describe('assignmentFailure', () => {
  it('la carrera de la reasignación pide el motivo y recarga el trámite', () => {
    expect(
      assignmentFailure(httpError(400, 'reason es obligatorio al reasignar'), 'assign'),
    ).toMatchObject({ refresh: true, field: 'reason', reasonRequired: true });
  });

  it('un destinatario fuera de la lista se marca en el campo y pide recargar la lista', () => {
    expect(
      assignmentFailure(
        httpError(400, 'El destinatario debe ser un Funcionario de la lista'),
        'assign',
      ),
    ).toMatchObject({ refresh: false, field: 'assignee', staleAssignees: true });
  });

  it.each([
    ['take', 'Otra persona tomó este trámite. Actualizamos la información.'],
    ['assign', 'El responsable del trámite cambió mientras tanto. Actualizamos la información.'],
  ] as const)('409 de responsable en %s recarga con un mensaje propio', (operation, message) => {
    expect(assignmentFailure(httpError(409, 'El tramite ya tiene responsable'), operation)).toEqual(
      {
        message,
        refresh: true,
      },
    );
  });

  it('409 por trámite cerrado y 404 recargan la vista', () => {
    expect(
      assignmentFailure(httpError(409, 'No se puede asignar un tramite cerrado'), 'assign'),
    ).toEqual({ message: 'El trámite ya está cerrado.', refresh: true });
    expect(assignmentFailure(httpError(404), 'take')).toEqual({
      message: 'El trámite ya no está disponible.',
      refresh: true,
    });
  });

  it('409 por el mismo responsable queda en el campo, sin recargar', () => {
    expect(
      assignmentFailure(httpError(409, 'El tramite ya esta asignado a ese funcionario'), 'assign'),
    ).toMatchObject({ field: 'assignee', refresh: false });
  });

  it('403 del responsable anterior explica que ya no opera el trámite', () => {
    expect(
      assignmentFailure(
        httpError(403, 'Solo el responsable del tramite puede reasignarlo'),
        'assign',
      ),
    ).toEqual({
      message: 'Ya no eres responsable de este trámite. Actualizamos la información.',
      refresh: true,
    });
    expect(assignmentFailure(httpError(403, 'Otro'), 'take')).toEqual({
      message: 'No tienes permiso para tomar este trámite.',
      refresh: true,
    });
  });

  it('sin red o con un error inesperado permite reintentar sin recargar', () => {
    expect(assignmentFailure(httpError(0), 'assign')).toEqual({
      message: 'No se pudo asignar el trámite. Revisa tu conexión e inténtalo de nuevo.',
      refresh: false,
    });
    expect(assignmentFailure(new Error('x'), 'take')).toEqual({
      message: 'No se pudo tomar el trámite. Inténtalo de nuevo.',
      refresh: false,
    });
  });
});
