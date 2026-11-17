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

  it('sin preferencia guardada sigue el sistema en contraste y movimiento', () => {
    const service = create();

    expect(service.preferences().contrastFollowSystem).toBe(true);
    expect(service.preferences().motionFollowSystem).toBe(true);
    expect(service.preferences().textStep).toBe(0);
    expect(['light', 'dark']).toContain(document.documentElement.dataset['bdContrast']);
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

  it('elegir un contraste deja de seguir el sistema', () => {
    const service = create();

    service.setContrast('high');

    expect(service.preferences().contrast).toBe('high');
    expect(service.preferences().contrastFollowSystem).toBe(false);
    expect(document.documentElement.dataset['bdContrast']).toBe('high');
  });

  it('restablecer vuelve a seguir el sistema y borra lo guardado', () => {
    const service = create();
    service.setContrast('negative');
    service.toggleGrayscale();
    service.setMotionPaused(true);

    service.reset();

    expect(service.preferences().contrastFollowSystem).toBe(true);
    expect(service.preferences().motionFollowSystem).toBe(true);
    expect(service.preferences().grayscale).toBe(false);
    expect(localStorage.getItem('bd.accessibility')).toBeNull();
    expect(document.documentElement.dataset['bdGrayscale']).toBeUndefined();
  });

  it('ignora un valor guardado que no es un modo de contraste', () => {
    localStorage.setItem('bd.accessibility', JSON.stringify({ contrast: 'sepia', textStep: 9 }));

    const service = create();

    expect(service.preferences().contrast).toBe('light');
    expect(service.preferences().contrastFollowSystem).toBe(false);
    expect(service.preferences().textStep).toBe(4);
  });

  it('pausar animaciones deja de seguir el sistema', () => {
    const service = create();
    service.setMotionPaused(true);

    expect(service.preferences().pauseMotion).toBe(true);
    expect(service.preferences().motionFollowSystem).toBe(false);
    expect(document.documentElement.dataset['bdMotion']).toBe('on');
  });
});
