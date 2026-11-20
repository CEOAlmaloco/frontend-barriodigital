const USER_DATA_PREFIXES = ['bd.profile.photo.', 'bd.profile.work.'] as const;

/** Borra la foto y las preferencias de trabajo del usuario. Los tokens los borra MSAL al cerrar sesión. */
export function clearUserData(): void {
  if (typeof window === 'undefined') {
    return;
  }
  for (const store of [window.sessionStorage, window.localStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && USER_DATA_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => store.removeItem(key));
  }
}
