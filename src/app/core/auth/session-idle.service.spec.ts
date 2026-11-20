import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';
import { SessionChannel, SessionMessage } from './session-channel';
import { SessionIdleService } from './session-idle.service';

const IDLE_MS = 15 * 60_000;

describe('SessionIdleService', () => {
  let messages: Subject<SessionMessage>;
  let auth: {
    role: ReturnType<typeof signal<Role | null>>;
    isAuthenticated: () => boolean;
    logout: ReturnType<typeof vi.fn>;
    endLocalSession: ReturnType<typeof vi.fn>;
  };
  let channel: { post: ReturnType<typeof vi.fn>; messages$: Subject<SessionMessage> };
  let navigate: ReturnType<typeof vi.fn>;

  const start = (role: Role) => {
    messages = new Subject<SessionMessage>();
    auth = {
      role: signal<Role | null>(role),
      isAuthenticated: () => true,
      logout: vi.fn(),
      endLocalSession: vi.fn(() => Promise.resolve()),
    };
    channel = { post: vi.fn(), messages$: messages };
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        SessionIdleService,
        { provide: AuthService, useValue: auth },
        { provide: SessionChannel, useValue: channel },
        { provide: Router, useValue: { navigateByUrl: navigate } },
        {
          provide: MatDialog,
          useValue: { open: vi.fn(() => ({ afterClosed: () => of(undefined), close: vi.fn() })) },
        },
      ],
    });
    TestBed.inject(SessionIdleService).start();
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cierra la sesión del personal tras el tiempo de inactividad', () => {
    start(Role.Funcionario);

    vi.advanceTimersByTime(IDLE_MS);

    expect(auth.logout).toHaveBeenCalled();
  });

  it('no aplica la inactividad al Vecino', () => {
    start(Role.Vecino);

    vi.advanceTimersByTime(IDLE_MS);

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('la actividad en otra pestaña reinicia el plazo', () => {
    start(Role.Funcionario);

    vi.advanceTimersByTime(IDLE_MS - 60_000);
    messages.next({ type: 'activity' });
    vi.advanceTimersByTime(IDLE_MS - 60_000);

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('avisa la actividad a las otras pestañas sin un mensaje por cada evento', () => {
    start(Role.Funcionario);

    window.dispatchEvent(new Event('mousemove'));
    window.dispatchEvent(new Event('mousemove'));

    expect(channel.post).toHaveBeenCalledTimes(1);
    expect(channel.post).toHaveBeenCalledWith({ type: 'activity' });
  });

  it('cierra la sesión local cuando otra pestaña cerró sesión', async () => {
    start(Role.Funcionario);

    messages.next({ type: 'logout' });
    await vi.runAllTimersAsync();

    expect(auth.endLocalSession).toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
