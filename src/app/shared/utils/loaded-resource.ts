import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, switchMap, tap } from 'rxjs';

import { PolledState } from './polled-resource';

export interface LoadedResource<K, T> {
  readonly key: Signal<K>;
  /** Misma forma que la de `polledResource`, para que una vista trate igual las dos fuentes. */
  readonly state: Signal<PolledState<K, T>>;
  /** Consulta la clave nueva y descarta la respuesta pendiente de la anterior. */
  setKey(key: K): void;
  refresh(): void;
}

/**
 * Fuente que se consulta al pedirla y no vuelve a consultar sola. Conserva los datos anteriores mientras llega
 * la respuesta y cuando la consulta falla, con `dataKey` para saber a qué clave corresponden. Se crea en un
 * contexto de inyección y descarta la consulta pendiente cuando este se destruye.
 */
export function loadedResource<K, T>(options: {
  key: K;
  load: (key: K) => Observable<T>;
}): LoadedResource<K, T> {
  const key = signal(options.key);
  const state = signal<PolledState<K, T>>({
    dataKey: null,
    data: null,
    fetchedAt: null,
    loading: false,
    failed: false,
    error: null,
  });
  const run$ = new Subject<K>();

  run$
    .pipe(
      switchMap((requested) => {
        state.update((current) => ({ ...current, loading: true }));
        return options.load(requested).pipe(
          tap((data) =>
            state.set({
              dataKey: requested,
              data,
              fetchedAt: new Date(),
              loading: false,
              failed: false,
              error: null,
            }),
          ),
          catchError((error: unknown) => {
            state.update((current) => ({ ...current, loading: false, failed: true, error }));
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe();

  return {
    key: key.asReadonly(),
    state: state.asReadonly(),
    setKey(next: K) {
      key.set(next);
      state.update((current) => ({ ...current, failed: false, error: null }));
      run$.next(next);
    },
    refresh() {
      run$.next(key());
    },
  };
}
