/** App Roles definidos en Microsoft Entra ID (barriodigital-infra/docs/decisiones.md). */
export const Role = {
  Admin: 'Admin',
  Funcionario: 'Funcionario',
  Vecino: 'Vecino',
  Auditor: 'Auditor',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
