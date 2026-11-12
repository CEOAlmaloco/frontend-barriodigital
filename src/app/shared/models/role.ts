/** App Roles definidos en Microsoft Entra ID (barriodigital-infra/docs/decisiones.md). */
export const Role = {
  Admin: 'Admin',
  Funcionario: 'Funcionario',
  Vecino: 'Vecino',
  Auditor: 'Auditor',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Roles con acceso a la vista de trámites (EP1-08). Los usan la navegación y el guard de la ruta. */
export const REQUESTS_ROLES: readonly Role[] = [Role.Vecino, Role.Funcionario];

/** El detalle admite a los cuatro roles (EP3-04, sección 2); requests decide qué trámite ve cada uno. */
export const REQUEST_DETAIL_ROLES: readonly Role[] = [
  Role.Vecino,
  Role.Funcionario,
  Role.Admin,
  Role.Auditor,
];
