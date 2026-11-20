import { DestroyRef, Injectable, inject } from '@angular/core';
import { EMPTY, Observable, fromEvent, map } from 'rxjs';

export type SessionMessage = { type: 'activity' } | { type: 'logout' };

/** Avisa a las otras pestañas de la actividad y del cierre de sesión. */
@Injectable({ providedIn: 'root' })
export class SessionChannel {
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('bd.session');

  readonly messages$: Observable<SessionMessage> = this.channel
    ? fromEvent<MessageEvent<SessionMessage>>(this.channel, 'message').pipe(
        map((event) => event.data),
      )
    : EMPTY;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  post(message: SessionMessage): void {
    this.channel?.postMessage(message);
  }
}
