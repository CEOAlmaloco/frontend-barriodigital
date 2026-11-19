/**
 * La Municipalidad de Alto Biobío se instaló el 6 de diciembre de 2004.
 * La comuna existe por la ley 19.959, publicada el 21 de julio de 2004;
 * el municipio empezó ese 6 de diciembre, al asumir el primer alcalde.
 */
export const MUNICIPALITY_SINCE = new Date(2004, 11, 6);

/** Fecha local en formato YYYY-MM-DD, el mismo de los query params from/to del GET de trámites. */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
