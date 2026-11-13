import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { AccountInfo, AuthenticationResult, InteractionStatus } from '@azure/msal-browser';
import { Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';

import { Role, RoleAccess, resolveAccess } from '../../shared/models/role';
import { apiScope, loginRequest } from './msal-config';
import { AccessTokenClaims, decodeJwtPayload } from './token-claims';

/** `pending` mientras se pide el token; `claims` en null si no se pudo leer. */
type ClaimsState = { status: 'pending' } | { status: 'loaded'; claims: AccessTokenClaims | null };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);
  private readonly interactionStatus = toSignal(inject(MsalBroadcastService).inProgress$, {
    initialValue: InteractionStatus.Startup,
  });
  private readonly claimsState = signal<ClaimsState>({ status: 'pending' });
  private claimsAccountId: string | null = null;
  private claims$: Observable<AccessTokenClaims | null> = of(null);

  readonly account = signal<AccountInfo | null>(null);
  readonly isAuthenticated = computed(() => this.account() !== null);
  /** Object ID de la cuenta en Entra ID; es el solicitanteId de los trámites. */
  readonly userId = computed(() => this.account()?.localAccountId ?? null);
  /** Acceso según el claim roles del accessToken de la API; null mientras llega el token. */
  readonly access = computed<RoleAccess | null>(() => {
    const state = this.claimsState();
    return state.status === 'pending' ? null : resolveAccess(tokenRoles(state.claims));
  });
  /** Único rol del usuario. Null sin rol, con más de uno o con el token sin leer. */
  readonly role = computed<Role | null>(() => {
    const access = this.access();
    return access?.kind === 'granted' ? access.role : null;
  });
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

  /** Lee el signal role, así que en plantillas se actualiza solo cuando llegan los claims. */
  hasRole(role: Role): boolean {
    return this.role() === role;
  }

  /**
   * Acceso una vez leído el accessToken. Pasa por hasSession porque los guards de una misma ruta
   * se suscriben a la vez, y la cuenta (y con ella la petición del token) se sincroniza ahí.
   */
  whenAccessResolved(): Observable<RoleAccess> {
    return this.hasSession().pipe(
      switchMap(() => this.claims$),
      map((claims) => resolveAccess(tokenRoles(claims))),
    );
  }

  /** Vuelve a pedir el token después de una falla de lectura. */
  retryAccess(): Observable<RoleAccess> {
    this.claimsAccountId = null;
    return this.whenAccessResolved();
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
    this.loadAccessTokenClaims(current);
  }

  /** Pide el accessToken de la API (desde caché si está vigente) solo cuando cambia la cuenta. */
  private loadAccessTokenClaims(account: AccountInfo | null): void {
    const accountId = account?.homeAccountId ?? null;

    if (accountId === this.claimsAccountId) {
      return;
    }

    this.claimsAccountId = accountId;
    this.claimsState.set({ status: 'pending' });

    if (!account) {
      this.claims$ = of(null);
      return;
    }

    this.claims$ = this.msal.acquireTokenSilent({ scopes: [apiScope], account }).pipe(
      map(({ accessToken }) => decodeJwtPayload(accessToken)),
      catchError((error: unknown) => {
        console.error('No se pudieron leer los roles del token de acceso', error);
        return of(null);
      }),
      tap((claims) => {
        if (this.claimsAccountId !== accountId) {
          return;
        }
        this.claimsState.set({ status: 'loaded', claims });
        if (claims === null) {
          // Sin claims legibles, la próxima sincronización vuelve a pedir el token
          this.claimsAccountId = null;
        }
      }),
      shareReplay(1),
    );
    this.claims$.subscribe();
  }

  private failLogin(error: unknown): void {
    console.error('No se pudo iniciar sesión con Microsoft Entra ID', error);
    this.loginFailed.set(true);
  }
}

/** Un token sin el claim roles es una cuenta sin rol; un token ilegible no permite decidir. */
function tokenRoles(claims: AccessTokenClaims | null): readonly string[] | null {
  return claims ? (claims.roles ?? []) : null;
}
