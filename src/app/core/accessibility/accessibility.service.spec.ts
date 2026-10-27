import { TestBed } from '@angular/core/testing';

import { AccessibilityService } from './accessibility.service';

describe('AccessibilityService', () => {
  beforeEach(() => {
    localStorage.clear();
    const root = document.documentElement;
    delete root.dataset['bdContrast'];
    delete root.dataset['bdScale'];
    delete root.dataset['bdGrayscale'];
    delete root.dataset['bdFont'];
    delete root.dataset['bdLinks'];
    delete root.dataset['bdMotion'];
    TestBed.resetTestingModule();
  });

  function create(): AccessibilityService {
    TestBed.configureTestingModule({});
    return TestBed.inject(AccessibilityService);
  }

  it('arranca en fondo claro y tamaño normal', () => {
    const service = create();

    expect(service.preferences().contrast).toBe('light');
    expect(service.preferences().textStep).toBe(0);
    expect(document.documentElement.dataset['bdContrast']).toBe('light');
    expect(document.documentElement.dataset['bdScale']).toBeUndefined();
  });

  it('aumenta el texto hasta el tope y lo recuerda', () => {
    const service = create();

    service.increaseText();
    service.increaseText();
    service.increaseText();
    service.increaseText();
    service.increaseText();

    expect(service.preferences().textStep).toBe(4);
    expect(document.documentElement.dataset['bdScale']).toBe('4');
    expect(JSON.parse(localStorage.getItem('bd.accessibility') ?? '{}').textStep).toBe(4);
  });

  it('no deja activo más de un modo de contraste', () => {
    const service = create();

    service.setContrast('dark');
    service.setContrast('high');

    expect(service.preferences().contrast).toBe('high');
    expect(document.documentElement.dataset['bdContrast']).toBe('high');
  });

  it('restablecer vuelve al inicio y borra lo guardado', () => {
    const service = create();
    service.setContrast('negative');
    service.toggleGrayscale();
    service.togglePauseMotion();

    service.reset();

    expect(service.preferences()).toEqual({
      textStep: 0,
      contrast: 'light',
      grayscale: false,
      readableFont: false,
      underlineLinks: false,
      pauseMotion: false,
    });
    expect(localStorage.getItem('bd.accessibility')).toBeNull();
    expect(document.documentElement.dataset['bdGrayscale']).toBeUndefined();
    expect(document.documentElement.dataset['bdMotion']).toBeUndefined();
  });

  it('ignora un valor guardado que no es un modo de contraste', () => {
    localStorage.setItem('bd.accessibility', JSON.stringify({ contrast: 'sepia', textStep: 9 }));

    const service = create();

    expect(service.preferences().contrast).toBe('light');
    expect(service.preferences().textStep).toBe(4);
  });
});
