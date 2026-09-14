import { TestBed } from '@angular/core/testing';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';

import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';
import { apiScope } from './msal-config';

const fakeJwt = (claims: object) =>
  ['e30', btoa(JSON.stringify(claims)).replace(/=+$/, ''), 'firma'].join('.');

describe('AuthService', () => {
  const adminAccount = {
    homeAccountId: 'admin-id',
    username: 'admin.test@cloudproyecto.onmicrosoft.com',
  } as AccountInfo;

  const createMsal = (activeAccount: AccountInfo | null) => ({
    instance: {
      getActiveAccount: vi.fn(() => activeAccount),
      getAllAccounts: vi.fn(() => []),
      setActiveAccount: vi.fn(),
    },
    initialize: vi.fn(() => of(undefined)),
    handleRedirectObservable: vi.fn(() => of(null)),
    acquireTokenSilent: vi.fn(() => of({ accessToken: fakeJwt({ roles: [Role.Admin] }) })),
    logoutRedirect: vi.fn(() => of(undefined)),
  });

  let msal: ReturnType<typeof createMsal>;

  const setup = (activeAccount: AccountInfo | null = null) => {
    msal = createMsal(activeAccount);

    TestBed.configureTestingModule({
      providers: [
        { provide: MsalService, useValue: msal },
        {
          provide: MsalBroadcastService,
          useValue: { inProgress$: new BehaviorSubject(InteractionStatus.None) },
        },
      ],
    });

    return TestBed.inject(AuthService);
  };

  it('inicializa MSAL una sola vez aunque el guard y el redirect lo pidan a la vez', async () => {
    const service = setup();

    await Promise.all([
      firstValueFrom(service.handleRedirect()),
      firstValueFrom(service.hasSession()),
    ]);

    expect(msal.initialize).toHaveBeenCalledTimes(1);
  });

  it('procesa el redirect en la redirectUri sin volver a la página donde empezó el login', async () => {
    const service = setup();

    await firstValueFrom(service.handleRedirect());

    expect(msal.handleRedirectObservable).toHaveBeenCalledWith({ navigateToLoginRequestUrl: false });
  });

  it('lee los roles del claim roles del accessToken de la API', async () => {
    const service = setup(adminAccount);

    await firstValueFrom(service.hasSession());

    expect(msal.acquireTokenSilent).toHaveBeenCalledWith({ scopes: [apiScope], account: adminAccount });
    expect(service.roles()).toEqual([Role.Admin]);
    expect(service.hasRole(Role.Admin)).toBe(true);
    expect(service.hasRole(Role.Vecino)).toBe(false);
  });

  it('no vuelve a pedir el token mientras la cuenta no cambie', async () => {
    const service = setup(adminAccount);

    await firstValueFrom(service.hasSession());
    await firstValueFrom(service.hasSession());

    expect(msal.acquireTokenSilent).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no pide token y no tiene roles', async () => {
    const service = setup();

    await firstValueFrom(service.hasSession());

    expect(msal.acquireTokenSilent).not.toHaveBeenCalled();
    expect(service.roles()).toEqual([]);
  });

  it('entrega los roles a los guards al llegar el token y expone el id de la cuenta', async () => {
    const service = setup({ ...adminAccount, localAccountId: 'oid-admin' } as AccountInfo);

    await firstValueFrom(service.hasSession());

    expect(await firstValueFrom(service.whenRolesLoaded())).toEqual([Role.Admin]);
    expect(service.userId()).toBe('oid-admin');
  });

  it('cierra sesión con logoutRedirect sobre la cuenta activa', async () => {
    const service = setup(adminAccount);

    await firstValueFrom(service.hasSession());
    service.logout();

    expect(msal.logoutRedirect).toHaveBeenCalledWith({ account: adminAccount });
  });
});
