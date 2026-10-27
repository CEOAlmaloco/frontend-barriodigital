import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

import {
  DEFAULT_ACCESSIBILITY,
  TEXT_STEP_MAX,
  TEXT_STEP_MIN,
  type AccessibilityPreferences,
  type ContrastMode,
  isContrastMode,
} from './accessibility.model';

const STORAGE_KEY = 'bd.accessibility';

/**
 * Aplica la accesibilidad en el documento y la recuerda en este navegador.
 * El segundo factor y la cuenta siguen en Microsoft; esto solo cambia la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  private readonly document = inject(DOCUMENT);

  readonly preferences = signal<AccessibilityPreferences>(DEFAULT_ACCESSIBILITY);

  constructor() {
    const stored = this.read();
    this.preferences.set(stored);
    this.apply(stored);
  }

  increaseText(): void {
    this.update({ textStep: Math.min(TEXT_STEP_MAX, this.preferences().textStep + 1) });
  }

  decreaseText(): void {
    this.update({ textStep: Math.max(TEXT_STEP_MIN, this.preferences().textStep - 1) });
  }

  setContrast(contrast: ContrastMode): void {
    this.update({ contrast });
  }

  toggleGrayscale(): void {
    this.update({ grayscale: !this.preferences().grayscale });
  }

  toggleReadableFont(): void {
    this.update({ readableFont: !this.preferences().readableFont });
  }

  toggleUnderlineLinks(): void {
    this.update({ underlineLinks: !this.preferences().underlineLinks });
  }

  togglePauseMotion(): void {
    this.update({ pauseMotion: !this.preferences().pauseMotion });
  }

  reset(): void {
    this.preferences.set(DEFAULT_ACCESSIBILITY);
    this.document.defaultView?.localStorage.removeItem(STORAGE_KEY);
    this.apply(DEFAULT_ACCESSIBILITY);
  }

  private update(patch: Partial<AccessibilityPreferences>): void {
    const view = this.document.defaultView;
    const keepPlace = patch.textStep !== undefined;
    const left = view?.scrollX ?? 0;
    const top = view?.scrollY ?? 0;
    const next = { ...this.preferences(), ...patch };
    this.preferences.set(next);
    view?.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.apply(next);
    if (keepPlace) {
      view?.requestAnimationFrame(() => view.scrollTo({ left, top, behavior: 'auto' }));
    }
  }

  private read(): AccessibilityPreferences {
    const raw = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_ACCESSIBILITY };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
      const textStep = Number(parsed.textStep);
      return {
        textStep: Number.isInteger(textStep)
          ? Math.min(TEXT_STEP_MAX, Math.max(TEXT_STEP_MIN, textStep))
          : 0,
        contrast: isContrastMode(parsed.contrast) ? parsed.contrast : 'light',
        grayscale: parsed.grayscale === true,
        readableFont: parsed.readableFont === true,
        underlineLinks: parsed.underlineLinks === true,
        pauseMotion: parsed.pauseMotion === true,
      };
    } catch {
      return { ...DEFAULT_ACCESSIBILITY };
    }
  }

  private apply(preferences: AccessibilityPreferences): void {
    const root = this.document.documentElement;
    root.dataset['bdContrast'] = preferences.contrast;
    if (preferences.textStep === 0) {
      delete root.dataset['bdScale'];
    } else {
      root.dataset['bdScale'] = String(preferences.textStep);
    }
    this.toggleFlag(root, 'bdGrayscale', preferences.grayscale);
    this.toggleFlag(root, 'bdFont', preferences.readableFont);
    this.toggleFlag(root, 'bdLinks', preferences.underlineLinks);
    this.toggleFlag(root, 'bdMotion', preferences.pauseMotion);
  }

  private toggleFlag(root: HTMLElement, name: string, enabled: boolean): void {
    if (enabled) {
      root.dataset[name] = 'on';
    } else {
      delete root.dataset[name];
    }
  }
}
