/** Páginas de información pública, enlazadas desde el pie del sitio y desde la navegación de esas páginas. */
export interface SiteInfoPage {
  readonly label: string;
  readonly path: string;
}

export const SITE_INFO_PAGES: readonly SiteInfoPage[] = [
  { label: 'Privacidad', path: '/legal/privacidad' },
  { label: 'Accesibilidad', path: '/legal/accesibilidad' },
  { label: 'Condiciones de uso', path: '/legal/condiciones-de-uso' },
];
