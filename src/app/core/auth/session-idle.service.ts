import { DestroyRef, Injectable, Injector, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';
import type { IdleWarningDialogComponent } from './idle-warning-dialog.component';
import { SessionChannel } from './session-channel';

const STAFF_ROLES: ReadonlySet<Role> = new Set([Role.Admin, Role.Funcionario, Role.Auditor]);
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
/** Limita los avisos entre pestañas: la actividad continua no necesita un mensaje por evento. */
const BROADCAST_INTERVAL_MS = 10_000;

/**
 * Cierra la sesión del personal tras la inactividad configurada, con aviso previo. La actividad cuenta en
 * todas las pestañas, y un cierre en una pestaña cierra las demás.
 */
@Injectable({ providedIn: 'root' })
export class SessionIdleService {
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly channel = inject(SessionChannel);
  private readonly destroyRef = inject(DestroyRef);

  private armed = false;
  private lastBroadcastAt = 0;
  private warnTimer: ReturnType<typeof setTimeout> | undefined;
  private logoutTimer: ReturnType<typeof setTimeout> | undefined;
  private dialogRef: MatDialogRef<IdleWarningDialogComponent, 'continue' | 'timeout'> | null = null;

  private readonly onActivity = (): void => {
    if (!this.isStaffSession()) {
      this.clearTimers();
      return;
    }
    this.resetTimers();
    const now = Date.now();
    if (now - this.lastBroadcastAt >= BROADCAST_INTERVAL_MS) {
      this.lastBroadcastAt = now;
      this.channel.post({ type: 'activity' });
    }
  };

  /** Arranca el monitoreo una vez montado el layout autenticado. */
  start(): void {
    if (this.armed || typeof window === 'undefined') {
      return;
    }
    this.armed = true;

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, this.onActivity, { passive: true });
    }

    this.channel.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      if (message.type === 'activity') {
        this.resetTimers();
      } else if (this.auth.isAuthenticated()) {
        this.clearTimers();
        void this.auth.endLocalSession().then(() => this.router.navigateByUrl('/'));
      }
    });

    this.destroyRef.onDestroy(() => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, this.onActivity);
      }
      this.clearTimers();
    });

    this.resetTimers();
  }

  private resetTimers(): void {
    this.clearTimers();
    if (!this.isStaffSession()) {
      return;
    }

    const idleMs = minutesToMs(environment.session.staffIdleMinutes);
    const warnBeforeMs = minutesToMs(environment.session.staffIdleWarnMinutes);
    const warnAtMs = Math.max(0, idleMs - warnBeforeMs);
    const secondsLeft = Math.max(1, Math.round(warnBeforeMs / 1000));

    const warnTimer = setTimeout(() => void this.openWarning(secondsLeft, warnTimer), warnAtMs);
    this.warnTimer = warnTimer;
    this.logoutTimer = setTimeout(() => this.forceLogout(), idleMs);
  }

  /** El diálogo se carga al primer aviso para no sumar Material Dialog al bundle inicial. */
  private async openWarning(
    secondsLeft: number,
    timer: ReturnType<typeof setTimeout>,
  ): Promise<void> {
    if (!this.isStaffSession() || this.dialogRef) {
      return;
    }
    const [{ MatDialog }, { IdleWarningDialogComponent }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./idle-warning-dialog.component'),
    ]);
    // Si hubo actividad mientras se cargaba, el aviso ya no corresponde
    if (this.warnTimer !== timer || this.dialogRef) {
      return;
    }
    this.dialogRef = this.injector.get(MatDialog).open(IdleWarningDialogComponent, {
      disableClose: true,
      width: '420px',
      data: { secondsLeft },
    });
    this.dialogRef.afterClosed().subscribe((result) => {
      this.dialogRef = null;
      if (result === 'continue') {
        this.resetTimers();
        return;
      }
      if (result === 'timeout') {
        this.forceLogout();
      }
    });
  }

  private forceLogout(): void {
    this.clearTimers();
    if (this.isStaffSession()) {
      this.auth.logout();
    }
  }

  private clearTimers(): void {
    if (this.warnTimer) {
      clearTimeout(this.warnTimer);
      this.warnTimer = undefined;
    }
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = undefined;
    }
    if (this.dialogRef) {
      this.dialogRef.close('continue');
      this.dialogRef = null;
    }
  }

  private isStaffSession(): boolean {
    const role = this.auth.role();
    return role != null && STAFF_ROLES.has(role) && this.auth.isAuthenticated();
  }
}

function minutesToMs(minutes: number): number {
  return Math.max(1, minutes) * 60_000;
}
