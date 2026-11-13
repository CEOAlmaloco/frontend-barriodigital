import { TestBed } from '@angular/core/testing';

import { AuditChange } from '../audit-event-view';
import { AuditChangeTableComponent } from './audit-change-table.component';

describe('AuditChangeTableComponent', () => {
  const render = async (change: AuditChange) => {
    const fixture = TestBed.createComponent(AuditChangeTableComponent);
    fixture.componentRef.setInput('change', change);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    return {
      caption: element.querySelector('caption')?.textContent?.trim(),
      headers: [...element.querySelectorAll('thead th')].map((th) => th.textContent?.trim()),
      element,
    };
  };

  it('en una edición marca lo modificado también para lectores de pantalla', async () => {
    const { caption, headers, element } = await render({
      mode: 'update',
      rows: [
        { field: 'Nombre', before: 'Bache', after: 'Bache', changed: false },
        { field: 'Cupo diario', before: '20', after: '15', changed: true },
      ],
    });
    expect(caption).toBe('Cambios');
    expect(headers).toEqual(['Campo', 'Antes', 'Después']);
    const changed = element.querySelectorAll('.change__row--changed');
    expect(changed.length).toBe(1);
    expect(changed[0].textContent).toContain('(modificado)');
  });

  it('en un alta muestra solo los valores iniciales y en una eliminación solo los previos', async () => {
    const created = await render({
      mode: 'create',
      rows: [{ field: 'Particiones', before: null, after: '3', changed: false }],
    });
    expect(created.caption).toBe('Valores iniciales');
    expect(created.headers).toEqual(['Campo', 'Después']);

    TestBed.resetTestingModule();
    const deleted = await render({
      mode: 'delete',
      rows: [{ field: 'Durable', before: 'Sí', after: null, changed: false }],
    });
    expect(deleted.caption).toBe('Valores al eliminar');
    expect(deleted.headers).toEqual(['Campo', 'Antes']);
  });

  it('en el resultado de una operación nombra la columna "Resultado" y marca los valores ausentes', async () => {
    const { caption, headers, element } = await render({
      mode: 'result',
      rows: [
        { field: 'Mensajes en la cola', before: '12', after: null, changed: false },
        { field: 'Mensajes eliminados', before: null, after: '12', changed: false },
      ],
    });
    expect(caption).toBe('Resultado de la operación');
    expect(headers).toEqual(['Campo', 'Antes', 'Resultado']);
    expect(element.querySelectorAll('.change__none[aria-hidden="true"]').length).toBe(2);
    expect(element.textContent?.match(/No aplica/g)?.length).toBe(2);
  });
});
