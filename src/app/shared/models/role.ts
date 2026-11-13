/** App Roles definidos en Microsoft Entra ID (barriodigital-infra/docs/decisiones.md). */
export const Role = {
  Admin: 'Admin',
  Funcionario: 'Funcionario',
  Vecino: 'Vecino',
  Auditor: 'Auditor',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

const BARRIO_ROLES: readonly Role[] = Object.values(Role);

/** Nombre del rol en la interfaz. */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  Admin: 'Administrador',
  Funcionario: 'Funcionario',
  Vecino: 'Vecino',
  Auditor: 'Auditor',
};

/**
 * Acceso del usuario según los roles de su token (EP3-04, secciones 1 y 4).
 * `unavailable` es un token que no se pudo leer: no implica que la cuenta no tenga rol.
 */
export type RoleAccess =
  | { kind: 'granted'; role: Role }
  | { kind: 'none' }
  | { kind: 'multiple'; roles: readonly Role[] }
  | { kind: 'unavailable' };

/**
 * Exige exactamente uno de los cuatro roles e ignora cualquier otro App Role,
 * igual que BarrioRoleGateFilter en el BFF, para que ambas capas decidan lo mismo con el mismo token.
 */
export function resolveAccess(tokenRoles: readonly string[] | null): RoleAccess {
  if (tokenRoles === null) {
    return { kind: 'unavailable' };
  }
  const roles = BARRIO_ROLES.filter((role) => tokenRoles.includes(role));
  if (roles.length === 0) {
    return { kind: 'none' };
  }
  return roles.length === 1 ? { kind: 'granted', role: roles[0] } : { kind: 'multiple', roles };
}

/** Los cuatro roles ven el listado y el detalle; requests decide qué trámites y campos ve cada uno. */
export const REQUESTS_ROLES: readonly Role[] = BARRIO_ROLES;

/** Control interno: el Admin y el Auditor revisan reportes y auditoría (EP3-04, sección 2). */
export const OVERSIGHT_ROLES: readonly Role[] = [Role.Admin, Role.Auditor];
