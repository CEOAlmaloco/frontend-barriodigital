import { TestBed } from '@angular/core/testing';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createMsal = () => ({
    instance: {
      getActiveAccount: vi.fn(() => null),
      getAllAccounts: vi.fn(() => []),
      setActiveAccount: vi.fn(),
    },
    initialize: vi.fn(() => of(undefined)),
    handleRedirectObservable: vi.fn(() => of(null)),
  });

  let msal: ReturnType<typeof createMsal>;
  let service: AuthService;

  beforeEach(() => {
    msal = createMsal();

    TestBed.configureTestingModule({
      providers: [
        { provide: MsalService, useValue: msal },
        {
          provide: MsalBroadcastService,
          useValue: { inProgress$: new BehaviorSubject(InteractionStatus.None) },
        },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('inicializa MSAL una sola vez aunque el guard y el redirect lo pidan a la vez', async () => {
    await Promise.all([
      firstValueFrom(service.handleRedirect()),
      firstValueFrom(service.hasSession()),
    ]);

    expect(msal.initialize).toHaveBeenCalledTimes(1);
  });

  it('procesa el redirect en la redirectUri sin volver a la página donde empezó el login', async () => {
    await firstValueFrom(service.handleRedirect());

    expect(msal.handleRedirectObservable).toHaveBeenCalledWith({ navigateToLoginRequestUrl: false });
  });
});
