import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subscriber } from 'rxjs';

import { LoadedResource, loadedResource } from './loaded-resource';

interface Call {
  key: number;
  subscriber: Subscriber<string>;
  settled: boolean;
  cancelled: boolean;
}

describe('loadedResource', () => {
  let calls: Call[];
  let injector: EnvironmentInjector;
  let resource: LoadedResource<number, string>;

  const respond = (value: string, call = calls.at(-1)!) => {
    call.settled = true;
    call.subscriber.next(value);
    call.subscriber.complete();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    resource = runInInjectionContext(injector, () =>
      loadedResource<number, string>({
        key: 0,
        load: (key) =>
          new Observable<string>((subscriber) => {
            const call: Call = { key, subscriber, settled: false, cancelled: false };
            calls.push(call);
            return () => {
              if (!call.settled) call.cancelled = true;
            };
          }),
      }),
    );
  });

  afterEach(() => {
    if (!(injector as EnvironmentInjector & { destroyed: boolean }).destroyed) {
      injector.destroy();
    }
    vi.useRealTimers();
  });

  it('consulta solo al pedirlo y no vuelve a consultar sola', () => {
    expect(calls).toHaveLength(0);
    resource.setKey(0);
    expect(resource.state().loading).toBe(true);

    respond('a');
    expect(resource.state()).toMatchObject({
      dataKey: 0,
      data: 'a',
      loading: false,
      failed: false,
    });
    expect(resource.state().fetchedAt).toBeInstanceOf(Date);
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(1);
  });

  it('conserva los datos y marca la falla cuando actualizar no responde', () => {
    resource.setKey(0);
    respond('a');
    resource.refresh();
    calls.at(-1)!.settled = true;
    calls.at(-1)!.subscriber.error(new Error('caído'));

    expect(resource.state()).toMatchObject({ dataKey: 0, data: 'a', loading: false, failed: true });
  });

  it('una clave nueva descarta la respuesta pendiente de la anterior', () => {
    resource.setKey(0);
    resource.setKey(1);

    expect(calls[0].cancelled).toBe(true);
    respond('b');
    expect(resource.key()).toBe(1);
    expect(resource.state()).toMatchObject({ dataKey: 1, data: 'b' });
  });

  it('una clave nueva limpia la falla de la anterior y la siguiente consulta sale de cero', () => {
    resource.setKey(0);
    calls[0].settled = true;
    calls[0].subscriber.error(new Error('caído'));
    resource.setKey(1);

    expect(resource.state()).toMatchObject({ failed: false, error: null, loading: true });
  });

  it('cancela la consulta pendiente al destruirse el contexto', () => {
    resource.setKey(0);
    injector.destroy();

    expect(calls[0].cancelled).toBe(true);
  });
});
