import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult, InteractionStatus } from '@azure/msal-browser';
import { Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';

import { loginRequest } from './msal-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);
  private readonly interactionStatus = toSignal(inject(MsalBroadcastService).inProgress$, {
    initialValue: InteractionStatus.Startup,
  });

  readonly account = signal<AccountInfo | null>(null);
  readonly isAuthenticated = computed(() => this.account() !== null);
  readonly isInteractionInProgress = computed(
    () => this.interactionStatus() !== InteractionStatus.None,
  );
  readonly loginFailed = signal(false);

  /** Única inicialización de MSAL. El guard y el procesamiento del redirect esperan esta misma promesa. */
  private readonly initialized$ = this.msal.initialize().pipe(shareReplay(1));

  /**
   * Procesa la respuesta de Entra ID al volver del redirect. Se llama una sola vez al iniciar la app.
   * navigateToLoginRequestUrl en false evita volver a la página donde empezó el login: tras un logout
   * esa URL trae ?state= de Entra ID y MSAL Angular lo toma como respuesta, lo que causa state_mismatch.
   */
  handleRedirect(): Observable<AuthenticationResult | null> {
    return this.initialized$.pipe(
      switchMap(() => this.msal.handleRedirectObservable({ navigateToLoginRequestUrl: false })),
      tap((result) => this.syncAccount(result?.account)),
      catchError((error: unknown) => {
        this.failLogin(error);
        return of(null);
      }),
    );
  }

  /** Indica si hay una sesión en caché, una vez inicializado MSAL. */
  hasSession(): Observable<boolean> {
    return this.initialized$.pipe(
      tap(() => this.syncAccount()),
      map(() => this.isAuthenticated()),
    );
  }

  login(): void {
    this.loginFailed.set(false);
    this.msal.loginRedirect(loginRequest).subscribe({
      error: (error: unknown) => this.failLogin(error),
    });
  }

  logout(): void {
    this.msal.logoutRedirect({ account: this.account() }).subscribe({
      error: (error: unknown) => console.error('No se pudo cerrar sesión en Microsoft Entra ID', error),
    });
  }

  private syncAccount(account?: AccountInfo | null): void {
    const instance = this.msal.instance;
    const current = account ?? instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;

    instance.setActiveAccount(current);
    this.account.set(current);
  }

  private failLogin(error: unknown): void {
    console.error('No se pudo iniciar sesión con Microsoft Entra ID', error);
    this.loginFailed.set(true);
  }
}
