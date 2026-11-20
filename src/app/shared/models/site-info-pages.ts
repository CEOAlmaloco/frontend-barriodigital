/** Páginas de información pública, enlazadas desde el pie del sitio y desde la navegación de esas páginas. */
export interface SiteInfoPage {
  readonly label: string;
  readonly path: string;
  /** Ícono de Material Icons de su pestaña. */
  readonly icon: string;
}

export const SITE_INFO_PAGES: readonly SiteInfoPage[] = [
  { label: 'Privacidad', path: '/legal/privacidad', icon: 'privacy_tip' },
  { label: 'Accesibilidad', path: '/legal/accesibilidad', icon: 'accessibility_new' },
  { label: 'Condiciones de uso', path: '/legal/condiciones-de-uso', icon: 'description' },
];
