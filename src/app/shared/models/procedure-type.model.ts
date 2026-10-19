/** Tipo de trámite del catálogo completo, incluidos los tipos inactivos. */
export interface ProcedureType {
  value: string;
  label: string;
  active: boolean;
  readonly dailyQuota: number | null;
  readonly remainingQuota: number | null;
}

export interface CreateProcedureType {
  value: string;
  label: string;
  active: boolean;
}

export interface UpdateProcedureType {
  label: string;
  active: boolean;
  dailyQuota: number | null;
}
