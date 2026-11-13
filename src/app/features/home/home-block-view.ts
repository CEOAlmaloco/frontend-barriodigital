import { FailureKind, failureKind } from '../../shared/utils/http-failure';
import { PolledState } from '../../shared/utils/polled-resource';

/**
 * Lo que un bloque de /inicio puede mostrar. Mientras llega otra clave (otra página) se mantienen los datos
 * anteriores atenuados, sin saltos de layout; si esa consulta falla, el bloque queda en error y no los presenta
 * como de la clave pedida.
 */
export type BlockView<T> =
  | { status: 'loading' }
  | { status: 'error'; kind: FailureKind; retrying: boolean }
  | { status: 'ready'; data: T; fetchedAt: Date; stale: boolean; loading: boolean };

export function blockView<K, T>(state: PolledState<K, T>, key: K): BlockView<T> {
  const current = state.dataKey === key;
  if (state.data !== null && state.fetchedAt && (current || (state.loading && !state.failed))) {
    return {
      status: 'ready',
      data: state.data,
      fetchedAt: state.fetchedAt,
      stale: current && state.failed,
      loading: state.loading,
    };
  }
  if (state.failed) {
    return { status: 'error', kind: failureKind(state.error), retrying: state.loading };
  }
  return { status: 'loading' };
}

/** Datos del bloque, o null mientras no estén listos. */
export function readyData<T>(view: BlockView<T>): T | null {
  return view.status === 'ready' ? view.data : null;
}
