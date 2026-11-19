import { HttpErrorResponse } from '@angular/common/http';

export type AssignmentOperation = 'take' | 'assign';

/**
 * Qué hacer ante un error de tomar o asignar (EP3-05, sección 4).
 * - `refresh`: el trámite cambió en el servidor y la vista debe recargarlo.
 * - `field`: el error corresponde a un campo del diálogo y se muestra junto a él.
 */
export interface AssignmentFailure {
  message: string;
  refresh: boolean;
  field?: 'assignee' | 'reason';
  /** La carrera de la sección 3.5: alguien tomó el trámite y ahora asignar es reasignar. */
  reasonRequired?: boolean;
  /** El destinatario salió de la lista de funcionarios. */
  staleAssignees?: boolean;
}

const ACTION = { take: 'tomar', assign: 'asignar' } as const;

export function assignmentFailure(
  error: unknown,
  operation: AssignmentOperation,
): AssignmentFailure {
  const generic = {
    message: `No se pudo ${ACTION[operation]} el trámite. Inténtalo de nuevo.`,
    refresh: false,
  };
  if (!(error instanceof HttpErrorResponse)) {
    return generic;
  }
  const backend = typeof error.error?.message === 'string' ? error.error.message : '';

  switch (error.status) {
    case 0:
      return {
        message: `No se pudo ${ACTION[operation]} el trámite. Revisa tu conexión e inténtalo de nuevo.`,
        refresh: false,
      };
    case 400:
      if (backend === 'reason es obligatorio al reasignar') {
        return {
          message:
            'Otra persona tomó el trámite mientras lo asignabas. Si igual quieres cambiar el responsable, indica el motivo de la reasignación.',
          refresh: true,
          field: 'reason',
          reasonRequired: true,
        };
      }
      if (backend === 'El destinatario debe ser un Funcionario de la lista') {
        return {
          message: 'Esa persona ya no está en la lista de funcionarios. Elige a otra.',
          refresh: false,
          field: 'assignee',
          staleAssignees: true,
        };
      }
      if (backend === 'reason no puede superar 500 caracteres') {
        return {
          message: 'El motivo no puede superar 500 caracteres.',
          refresh: false,
          field: 'reason',
        };
      }
      return generic;
    case 403:
      if (backend === 'Solo el responsable del tramite puede reasignarlo') {
        return {
          message: 'Ya no eres responsable de este trámite. Actualizamos la información.',
          refresh: true,
        };
      }
      return {
        message: `No tienes permiso para ${ACTION[operation]} este trámite.`,
        refresh: true,
      };
    case 404:
      return { message: 'El trámite ya no está disponible.', refresh: true };
    case 409:
      if (backend === 'No se puede asignar un tramite cerrado') {
        return { message: 'El trámite ya está cerrado.', refresh: true };
      }
      if (backend === 'El tramite ya esta asignado a ese funcionario') {
        return {
          message: 'Esa persona ya es la responsable del trámite. Elige a otra.',
          refresh: false,
          field: 'assignee',
        };
      }
      return {
        message:
          operation === 'take'
            ? 'Otra persona tomó este trámite. Actualizamos la información.'
            : 'El responsable del trámite cambió mientras tanto. Actualizamos la información.',
        refresh: true,
      };
    default:
      return generic;
  }
}
