import { procedureTypeLabel } from './procedure-label';

describe('procedureTypeLabel', () => {
  const catalog = new Map([
    ['bache', 'Bache en calzada'],
    ['poda', '   '],
  ]);

  it('un tipo renombrado se lee con el nombre actual del catálogo', () => {
    expect(procedureTypeLabel('bache', 'Bache en calle', catalog)).toBe('Bache en calzada');
  });

  it('un trámite antiguo sin nombre guardado toma el del catálogo', () => {
    expect(procedureTypeLabel('bache', null, catalog)).toBe('Bache en calzada');
  });

  it('un tipo ausente del catálogo usa el nombre guardado y, sin él, el código', () => {
    expect(procedureTypeLabel('alumbrado', 'Luminaria apagada', catalog)).toBe('Luminaria apagada');
    expect(procedureTypeLabel('alumbrado', '  ', catalog)).toBe('alumbrado');
  });

  it('con el catálogo no disponible usa el nombre guardado', () => {
    expect(procedureTypeLabel('bache', 'Bache en calle', new Map())).toBe('Bache en calle');
  });

  it('un nombre vacío en el catálogo no tapa el nombre guardado', () => {
    expect(procedureTypeLabel('poda', 'Poda de árboles', catalog)).toBe('Poda de árboles');
  });
});
