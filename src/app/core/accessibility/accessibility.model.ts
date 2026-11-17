/** Preferencias visuales de una persona. No cambian permisos ni datos. */
export type ContrastMode = 'light' | 'high' | 'negative' | 'dark';

export interface AccessibilityPreferences {
  /** -1 reduce, 0 es el tamaño de la interfaz, hasta 4 aumenta. */
  textStep: number;
  contrast: ContrastMode;
  /** Si es true, light/dark siguen `prefers-color-scheme` (high/negative no). */
  contrastFollowSystem: boolean;
  grayscale: boolean;
  readableFont: boolean;
  underlineLinks: boolean;
  pauseMotion: boolean;
  /** Si es true, el movimiento sigue `prefers-reduced-motion`. */
  motionFollowSystem: boolean;
}

export const TEXT_STEP_MIN = -1;
export const TEXT_STEP_MAX = 4;

/** Sin preferencia guardada: seguir el sistema en contraste y movimiento. */
export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  textStep: 0,
  contrast: 'light',
  contrastFollowSystem: true,
  grayscale: false,
  readableFont: false,
  underlineLinks: false,
  pauseMotion: false,
  motionFollowSystem: true,
};

const CONTRAST_MODES: readonly ContrastMode[] = ['light', 'high', 'negative', 'dark'];

export function isContrastMode(value: unknown): value is ContrastMode {
  return typeof value === 'string' && CONTRAST_MODES.includes(value as ContrastMode);
}
