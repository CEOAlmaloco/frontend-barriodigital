/**
 * Nombre del tipo de un trámite, con el mismo criterio en listado, detalle e inicio: el nombre actual del
 * catálogo, para que un tipo renombrado se lea igual en todas las vistas; si el catálogo no está o no tiene el
 * tipo, el nombre guardado al crear el trámite; y como último recurso, el código. La auditoría no lo usa:
 * conserva el nombre que tenía el tipo cuando ocurrió el hecho.
 */
export function procedureTypeLabel(
  procedureType: string,
  savedLabel: string | null | undefined,
  catalogLabels: ReadonlyMap<string, string>,
): string {
  return catalogLabels.get(procedureType)?.trim() || savedLabel?.trim() || procedureType;
}
