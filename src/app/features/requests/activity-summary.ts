import { RequestStatus } from '../../shared/models/request.model';
import { CONTACT_CHANNELS, CONTACT_RESULTS, REQUEST_STATUS_VIEW } from './requests.constants';
import { RequestActivityEvent } from './requests.service';

export interface ActivityText {
  title: string;
  /** Motivo que se muestra aparte del título: el del rechazo o el de la reasignación. */
  reason: string | null;
}

/**
 * Título del evento armado con sus campos estructurados. Si faltan, usa el summary del backend sin el punto
 * final, porque es la única redacción disponible (por ejemplo, el hito público que recibe el Vecino).
 */
export function activityText(event: RequestActivityEvent): ActivityText {
  const fallback = { title: withoutPeriod(event.summary), reason: null };
  switch (event.kind) {
    case 'GESTION': {
      const channel = labelOf(CONTACT_CHANNELS, event.channel);
      const result = labelOf(CONTACT_RESULTS, event.result);
      return channel && result ? { title: `${channel} · ${result}`, reason: null } : fallback;
    }
    case 'ESTADO': {
      const from = statusLabel(event.fromStatus);
      const to = statusLabel(event.toStatus);
      if (!from || !to) return fallback;
      return {
        title: `Pasó de ${from} a ${to}`,
        reason: event.toStatus === 'RECHAZADO' ? event.reason?.trim() || null : null,
      };
    }
    case 'ASIGNACION': {
      const assignee = event.assigneeName?.trim();
      if (!assignee) return fallback;
      const previous = event.previousAssigneeName?.trim();
      if (previous) {
        return {
          title: `Reasignó de ${previous} a ${assignee}`,
          reason: event.reason?.trim() || null,
        };
      }
      return {
        title:
          event.actorId && event.actorId === event.assigneeId
            ? 'Tomó el trámite'
            : `Asignó a ${assignee}`,
        reason: null,
      };
    }
    default:
      return fallback;
  }
}

function withoutPeriod(text: string | null | undefined): string {
  return (text ?? '').trim().replace(/\.$/, '');
}

function statusLabel(status: RequestStatus | null): string | null {
  return status ? (REQUEST_STATUS_VIEW[status]?.label ?? null) : null;
}

function labelOf(
  options: readonly { value: string; label: string }[],
  value: string | null,
): string | null {
  return options.find((option) => option.value === value)?.label ?? null;
}
