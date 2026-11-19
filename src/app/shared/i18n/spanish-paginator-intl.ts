import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

const numberFormat = new Intl.NumberFormat('es-CL');

@Injectable()
export class SpanishPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Filas por página';
  override nextPageLabel = 'Página siguiente';
  override previousPageLabel = 'Página anterior';
  override firstPageLabel = 'Primera página';
  override lastPageLabel = 'Última página';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 de ${numberFormat.format(length)}`;
    }
    const start = page * pageSize;
    const end = Math.min(start + pageSize, length);
    return `${numberFormat.format(start + 1)} – ${numberFormat.format(end)} de ${numberFormat.format(length)}`;
  };
}
