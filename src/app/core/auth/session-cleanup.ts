/** Prefijos de datos de usuario en el navegador (perfil / atención). */
const USER_DATA_PREFIXES = ['bd.profile.photo.', 'bd.profile.work.'] as const;

/**
 * Borra tokens MSAL y datos de usuario del almacenamiento del navegador (EP3.5-08).
 * No toca preferencias de accesibilidad (`bd.accessibility`).
 */
export function clearBrowserSessionData(storage: Storage | undefined | null = undefined): void {
  const targets: Storage[] = [];
  if (typeof window !== 'undefined') {
    targets.push(window.sessionStorage, window.localStorage);
  }
  if (storage) {
    targets.push(storage);
  }

  for (const store of new Set(targets)) {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      if (key.startsWith('msal.') || key.includes('login.windows') || isUserDataKey(key)) {
        store.removeItem(key);
      }
    }
  }
}

function isUserDataKey(key: string): boolean {
  return USER_DATA_PREFIXES.some((prefix) => key.startsWith(prefix));
}
