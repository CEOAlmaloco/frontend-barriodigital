import { REQUESTS_ROLES, Role, resolveAccess } from './role';

describe('resolveAccess', () => {
  it.each(Object.values(Role))('con solo %s concede ese rol', (role) => {
    expect(resolveAccess([role])).toEqual({ kind: 'granted', role });
  });

  it.each([{ roles: [] }, { roles: ['Lector', 'Task.Read'] }])(
    'sin ninguno de los cuatro roles ($roles) no tiene rol',
    ({ roles }) => {
      expect(resolveAccess(roles)).toEqual({ kind: 'none' });
    },
  );

  it('ignora los App Roles ajenos a BarrioDigital, como el BFF', () => {
    expect(resolveAccess(['Lector', Role.Auditor])).toEqual({
      kind: 'granted',
      role: Role.Auditor,
    });
  });

  it.each([
    { roles: [Role.Funcionario, Role.Admin], expected: [Role.Admin, Role.Funcionario] },
    {
      roles: [Role.Auditor, Role.Vecino, Role.Admin],
      expected: [Role.Admin, Role.Vecino, Role.Auditor],
    },
  ])('con $roles rechaza la combinación y conserva los roles', ({ roles, expected }) => {
    expect(resolveAccess(roles)).toEqual({ kind: 'multiple', roles: expected });
  });

  it('un rol repetido en el token sigue siendo uno', () => {
    expect(resolveAccess([Role.Vecino, Role.Vecino])).toEqual({
      kind: 'granted',
      role: Role.Vecino,
    });
  });

  it('sin claims legibles no decide el rol', () => {
    expect(resolveAccess(null)).toEqual({ kind: 'unavailable' });
  });

  it('el listado de trámites admite a los cuatro roles (EP3-04)', () => {
    expect([...REQUESTS_ROLES].sort()).toEqual(Object.values(Role).sort());
  });
});
