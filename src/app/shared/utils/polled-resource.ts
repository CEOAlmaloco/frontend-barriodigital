import { DOCUMENT } from '@angular/common';
import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  filter,
  fromEvent,
  repeat,
  switchMap,
  tap,
  timer,
} from 'rxjs';

export const POLL_INTERVAL_MS = 5_000;
export const POLL_MAX_DELAY_MS = 60_000;

export interface PolledState<K, T> {
  /** Clave a la que corresponden `data` y `fetchedAt`; puede no ser la clave pedida. */
  dataKey: K | null;
  data: T | null;
  fetchedAt: Date | null;
  loading: boolean;
  /** Falló el último intento de la clave pedida. */
  failed: boolean;
  error: unknown;
}

export interface PolledResource<K, T> {
  readonly key: Signal<K>;
  readonly state: Signal<PolledState<K, T>>;
  readonly paused: Signal<boolean>;
  /** Consulta la clave nueva de inmediato, también en pausa. */
  setKey(key: K): void;
  /** Consulta una vez. Con el polling activo el ciclo sigue desde ahí; en pausa no lo reactiva. */
  refresh(): void;
  setPaused(paused: boolean): void;
}

export interface PolledResourceOptions<K, T> {
  key: K;
  load: (key: K) => Observable<T>;
  interval?: number;
  maxDelay?: number;
}

/**
 * Polling de una fuente (K8). La consulta siguiente se agenda cuando termina la anterior, así una respuesta
 * lenta no se cancela ni se superpone con otra. Con la pestaña oculta o en pausa no se agenda ninguna, y al
 * volver a la pestaña se consulta de inmediato. Tras un error la espera se duplica hasta `maxDelay` y vuelve
 * al intervalo con el primer éxito. Se crea en un contexto de inyección y se detiene cuando este se destruye.
 */
export function polledResource<K, T>(options: PolledResourceOptions<K, T>): PolledResource<K, T> {
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  const interval = options.interval ?? POLL_INTERVAL_MS;
  const maxDelay = options.maxDelay ?? POLL_MAX_DELAY_MS;

  const key = signal(options.key);
  const paused = signal(false);
  const state = signal<PolledState<K, T>>({
    dataKey: null,
    data: null,
    fetchedAt: null,
    loading: false,
    failed: false,
    error: null,
  });
  const run$ = new Subject<void>();
  let failures = 0;

  const active = () => !paused() && document.visibilityState !== 'hidden';
  const nextDelay = () => Math.min(interval * 2 ** failures, maxDelay);

  const fetchOnce = defer(() => {
    const requested = key();
    state.update((current) => ({ ...current, loading: true }));
    return options.load(requested).pipe(
      tap((data) => {
        failures = 0;
        state.set({
          dataKey: requested,
          data,
          fetchedAt: new Date(),
          loading: false,
          failed: false,
          error: null,
        });
      }),
      catchError((error: unknown) => {
        failures++;
        state.update((current) => ({ ...current, loading: false, failed: true, error }));
        return EMPTY;
      }),
    );
  });

  // switchMap reinicia el ciclo y descarta la respuesta pendiente de una clave anterior.
  run$
    .pipe(
      switchMap(() =>
        fetchOnce.pipe(
          repeat({
            delay: () => (active() ? timer(nextDelay()).pipe(filter(active)) : EMPTY),
          }),
        ),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  fromEvent(document, 'visibilitychange')
    .pipe(filter(active), takeUntilDestroyed(destroyRef))
    .subscribe(() => run$.next());

  return {
    key: key.asReadonly(),
    state: state.asReadonly(),
    paused: paused.asReadonly(),
    setKey(next: K) {
      key.set(next);
      failures = 0;
      state.update((current) => ({ ...current, failed: false, error: null }));
      run$.next();
    },
    refresh() {
      run$.next();
    },
    setPaused(value: boolean) {
      if (value === paused()) {
        return;
      }
      paused.set(value);
      if (active()) {
        run$.next();
      }
    },
  };
}
