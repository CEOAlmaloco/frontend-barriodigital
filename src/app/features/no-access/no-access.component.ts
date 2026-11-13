import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS, RoleAccess } from '../../shared/models/role';
import { environment } from '../../../environments/environment';

type DeniedAccess = Exclude<RoleAccess, { kind: 'granted' }>;

interface Reason {
  icon: string;
  title: string;
  supportSubject: string;
}

const REASONS: Readonly<Record<DeniedAccess['kind'], Reason>> = {
  none: {
    icon: 'no_accounts',
    title: 'No puedes ingresar a BarrioDigital',
    supportSubject: 'Cuenta sin rol en BarrioDigital',
  },
  multiple: {
    icon: 'manage_accounts',
    title: 'No puedes ingresar a BarrioDigital',
    supportSubject: 'Cuenta con más de un rol en BarrioDigital',
  },
  unavailable: {
    icon: 'cloud_off',
    title: 'No pudimos verificar tus permisos',
    supportSubject: 'No se pueden verificar mis permisos en BarrioDigital',
  },
};

const roleList = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

/** Destino de una sesión sin un rol válido (EP3-04, sección 4): explica el motivo y cómo salir de ahí. */
@Component({
  selector: 'app-no-access',
  imports: [MatButton, MatIcon, MatProgressSpinner],
  templateUrl: './no-access.component.html',
  styleUrl: './no-access.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAccessComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Conserva el último motivo mientras se vuelve a pedir el token, para no vaciar la pantalla. */
  protected readonly denied = linkedSignal<RoleAccess | null, DeniedAccess>({
    source: this.auth.access,
    computation: (access, previous) =>
      access && access.kind !== 'granted' ? access : (previous?.value ?? { kind: 'unavailable' }),
  });
  protected readonly reason = computed(() => REASONS[this.denied().kind]);
  protected readonly roles = computed(() => {
    const denied = this.denied();
    return denied.kind === 'multiple'
      ? roleList.format(denied.roles.map((role) => ROLE_LABELS[role]))
      : '';
  });
  protected readonly accountName = computed(() => this.auth.account()?.name ?? '');
  protected readonly accountUsername = computed(() => this.auth.account()?.username ?? '');
  protected readonly retrying = signal(false);
  protected readonly retryFailed = signal(false);

  protected readonly supportHref = computed(() => {
    const subject = encodeURIComponent(this.reason().supportSubject);
    const username = this.accountUsername();
    const body = username ? `&body=${encodeURIComponent(`Cuenta: ${username}`)}` : '';
    return `mailto:${environment.supportEmail}?subject=${subject}${body}`;
  });

  constructor() {
    effect(() => {
      if (this.auth.access()?.kind === 'granted') {
        this.router.navigateByUrl('/inicio', { replaceUrl: true });
      }
    });
  }

  protected retry(): void {
    if (this.retrying()) {
      return;
    }
    this.retrying.set(true);
    this.retryFailed.set(false);
    this.auth
      .retryAccess()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((access) => {
        this.retrying.set(false);
        this.retryFailed.set(access.kind === 'unavailable');
      });
  }

  protected signOut(): void {
    this.auth.logout();
  }
}
