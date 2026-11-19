import { DestroyRef, Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../environments/environment';
import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';
import { IdleWarningDialogComponent } from './idle-warning-dialog.component';

const STAFF_ROLES: ReadonlySet<Role> = new Set([Role.Admin, Role.Funcionario, Role.Auditor]);
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Cierra la sesión del personal tras inactividad configurable, con aviso previo (EP3.5-08).
 */
@Injectable({ providedIn: 'root' })
export class SessionIdleService {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private armed = false;
  private warnTimer: ReturnType<typeof setTimeout> | undefined;
  private logoutTimer: ReturnType<typeof setTimeout> | undefined;
  private dialogRef: MatDialogRef<IdleWarningDialogComponent, 'continue' | 'timeout'> | null = null;

  private readonly onActivity = (): void => {
    if (!this.isStaffSession()) {
      this.clearTimers();
      return;
    }
    this.resetTimers();
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

    this.warnTimer = setTimeout(() => this.openWarning(secondsLeft), warnAtMs);
    this.logoutTimer = setTimeout(() => this.forceLogout(), idleMs);
  }

  private openWarning(secondsLeft: number): void {
    if (!this.isStaffSession() || this.dialogRef) {
      return;
    }
    this.dialogRef = this.dialog.open(IdleWarningDialogComponent, {
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
