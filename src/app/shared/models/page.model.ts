/** Respuesta paginada común de requests, report y audit (EP3-07, sección 2.1). */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
