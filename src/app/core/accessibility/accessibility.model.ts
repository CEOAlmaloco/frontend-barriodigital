/** Preferencias visuales de una persona. No cambian permisos ni datos. */
export type ContrastMode = 'light' | 'high' | 'negative' | 'dark';

export interface AccessibilityPreferences {
  /** -1 reduce, 0 es el tamaño de la interfaz, hasta 4 aumenta. */
  textStep: number;
  contrast: ContrastMode;
  grayscale: boolean;
  readableFont: boolean;
  underlineLinks: boolean;
  pauseMotion: boolean;
}

export const TEXT_STEP_MIN = -1;
export const TEXT_STEP_MAX = 4;

export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  textStep: 0,
  contrast: 'light',
  grayscale: false,
  readableFont: false,
  underlineLinks: false,
  pauseMotion: false,
};

const CONTRAST_MODES: readonly ContrastMode[] = ['light', 'high', 'negative', 'dark'];

export function isContrastMode(value: unknown): value is ContrastMode {
  return typeof value === 'string' && CONTRAST_MODES.includes(value as ContrastMode);
}
