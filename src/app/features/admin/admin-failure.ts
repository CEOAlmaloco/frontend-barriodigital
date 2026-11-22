import { FailureKind } from '../../shared/utils/http-failure';

export interface AdminFailureCopy {
  icon: string;
  heading: string;
  message: string;
  retry: boolean;
}

/** Textos de la sección sin datos, con el mismo criterio que Reportes: servicio caído, sin permiso u otro. */
export function adminFailureCopy(
  kind: FailureKind,
  section: { unavailable: string; generic: string },
): AdminFailureCopy {
  switch (kind) {
    case 'unavailable':
      return {
        icon: 'cloud_off',
        heading: section.unavailable,
        message: 'El servicio no responde. Inténtalo en unos minutos.',
        retry: true,
      };
    case 'forbidden':
      return {
        icon: 'lock',
        heading: 'No tienes acceso a esta sección',
        message: 'Tu rol no permite administrar esta información.',
        retry: false,
      };
    default:
      return {
        icon: 'wifi_off',
        heading: section.generic,
        message: 'Revisa tu conexión e inténtalo de nuevo.',
        retry: true,
      };
  }
}
