/** Tipo de trámite del catálogo completo, incluidos los tipos inactivos. */
export interface ProcedureType {
  value: string;
  label: string;
  active: boolean;
  readonly dailyQuota: number | null;
  readonly remainingQuota: number | null;
  /** Días hábiles de atención, de 1 a 120; null es sin plazo (EP3-06, sección 1.1). */
  readonly slaBusinessDays: number | null;
}

export interface CreateProcedureType {
  value: string;
  label: string;
  active: boolean;
  slaBusinessDays: number | null;
}

export interface UpdateProcedureType {
  label: string;
  active: boolean;
  dailyQuota: number | null;
  /** El PUT reemplaza el valor completo: si falta, el tipo queda sin plazo. Se envía siempre. */
  slaBusinessDays: number | null;
}
