import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subscriber } from 'rxjs';

import { PolledResource, polledResource } from './polled-resource';

interface Call {
  key: string;
  subscriber: Subscriber<string>;
  settled: boolean;
  cancelled: boolean;
}

describe('polledResource', () => {
  let calls: Call[];
  let injector: EnvironmentInjector;
  let resource: PolledResource<string, string>;
  let visibility: DocumentVisibilityState;

  const respond = (value = `datos-${calls.length}`, call = calls.at(-1)!) => {
    call.settled = true;
    call.subscriber.next(value);
    call.subscriber.complete();
  };
  const fail = (call = calls.at(-1)!) => {
    call.settled = true;
    call.subscriber.error(new Error('caído'));
  };
  const setVisibility = (value: DocumentVisibilityState) => {
    visibility = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    resource = runInInjectionContext(injector, () =>
      polledResource<string, string>({
        key: 'last24h',
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
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it('consulta al recibir la clave y repite 5 s después de cada respuesta', () => {
    expect(calls).toHaveLength(0);
    resource.setKey('last24h');
    expect(calls).toHaveLength(1);
    expect(resource.state().loading).toBe(true);

    respond('a');
    expect(resource.state()).toMatchObject({ dataKey: 'last24h', data: 'a', loading: false });
    vi.advanceTimersByTime(4_999);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
  });

  it('una respuesta de más de 5 s no se cancela ni se superpone con otra consulta', () => {
    resource.setKey('last24h');
    vi.advanceTimersByTime(12_000);
    expect(calls).toHaveLength(1);
    expect(calls[0].cancelled).toBe(false);

    respond('lenta');
    expect(resource.state().data).toBe('lenta');
    vi.advanceTimersByTime(5_000);
    expect(calls).toHaveLength(2);
  });

  it('no consulta con la pestaña oculta y consulta de inmediato al volver', () => {
    resource.setKey('last24h');
    respond();
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(1);

    setVisibility('visible');
    expect(calls).toHaveLength(2);
    respond();
    vi.advanceTimersByTime(5_000);
    expect(calls).toHaveLength(3);
  });

  it('la consulta en curso al ocultar la pestaña termina, pero no agenda otra', () => {
    resource.setKey('last24h');
    setVisibility('hidden');
    respond('al ocultar');
    expect(resource.state().data).toBe('al ocultar');
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(1);
  });

  it('ante errores espera cada vez más, hasta 60 s, y vuelve a 5 s con el primer éxito', () => {
    resource.setKey('last24h');
    for (const delay of [10_000, 20_000, 40_000, 60_000, 60_000]) {
      fail();
      expect(resource.state().failed).toBe(true);
      const before = calls.length;
      vi.advanceTimersByTime(delay - 1);
      expect(calls).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(calls).toHaveLength(before + 1);
    }
    respond();
    expect(resource.state().failed).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(calls).toHaveLength(7);
  });

  it('un error conserva los últimos datos con su hora de consulta', () => {
    resource.setKey('last24h');
    respond('previos');
    const fetchedAt = resource.state().fetchedAt;
    vi.advanceTimersByTime(5_000);
    fail();
    expect(resource.state()).toMatchObject({
      dataKey: 'last24h',
      data: 'previos',
      fetchedAt,
      failed: true,
    });
  });

  it('en pausa no agenda consultas; actualizar y cambiar la clave consultan una vez sin reanudar', () => {
    resource.setKey('last24h');
    respond();
    resource.setPaused(true);
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(1);

    resource.refresh();
    expect(calls).toHaveLength(2);
    respond();
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(2);

    resource.setKey('last7d');
    expect(calls.at(-1)?.key).toBe('last7d');
    respond();
    vi.advanceTimersByTime(60_000);
    expect(calls).toHaveLength(3);
    expect(resource.paused()).toBe(true);
  });

  it('al reanudar consulta de inmediato y retoma el ciclo', () => {
    resource.setKey('last24h');
    respond();
    resource.setPaused(true);
    resource.setPaused(false);
    expect(calls).toHaveLength(2);
    respond();
    vi.advanceTimersByTime(5_000);
    expect(calls).toHaveLength(3);
  });

  it('cambiar la clave descarta la respuesta pendiente de la anterior', () => {
    resource.setKey('last24h');
    respond('24h');
    vi.advanceTimersByTime(5_000);
    const pending = calls.at(-1)!;

    resource.setKey('last7d');
    expect(pending.cancelled).toBe(true);
    expect(resource.key()).toBe('last7d');
  });

  it('si falla la clave nueva, los datos guardados siguen marcados con la clave anterior', () => {
    resource.setKey('last24h');
    respond('24h');
    resource.setKey('last7d');
    expect(resource.state().failed).toBe(false);
    fail();
    expect(resource.state()).toMatchObject({ dataKey: 'last24h', data: '24h', failed: true });
    expect(resource.key()).toBe('last7d');
  });

  it('deja de consultar al destruirse su contexto', () => {
    resource.setKey('last24h');
    respond();
    injector.destroy();
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    expect(calls).toHaveLength(1);
  });
});
