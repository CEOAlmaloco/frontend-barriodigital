import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';
import { SessionIdleService } from './session-idle.service';

function dialogStub() {
  return {
    open: vi.fn(() => ({
      afterClosed: () => of(undefined),
      close: vi.fn(),
    })),
  };
}

describe('SessionIdleService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cierra la sesión del personal tras el tiempo de inactividad', () => {
    const logout = vi.fn();
    const role = signal<Role | null>(Role.Funcionario);
    TestBed.configureTestingModule({
      providers: [
        SessionIdleService,
        {
          provide: AuthService,
          useValue: {
            role,
            isAuthenticated: () => true,
            logout,
          },
        },
        { provide: MatDialog, useValue: dialogStub() },
      ],
    });

    TestBed.inject(SessionIdleService).start();
    vi.advanceTimersByTime(15 * 60_000);

    expect(logout).toHaveBeenCalled();
  });

  it('no aplica idle al Vecino', () => {
    const logout = vi.fn();
    const role = signal<Role | null>(Role.Vecino);
    TestBed.configureTestingModule({
      providers: [
        SessionIdleService,
        {
          provide: AuthService,
          useValue: {
            role,
            isAuthenticated: () => true,
            logout,
          },
        },
        { provide: MatDialog, useValue: dialogStub() },
      ],
    });

    TestBed.inject(SessionIdleService).start();
    vi.advanceTimersByTime(15 * 60_000);

    expect(logout).not.toHaveBeenCalled();
  });
});
