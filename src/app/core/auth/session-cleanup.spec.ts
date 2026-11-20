import { afterEach, describe, expect, it } from 'vitest';

import { clearUserData } from './session-cleanup';

describe('clearUserData', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('borra la foto y las preferencias de trabajo, y conserva la accesibilidad y la caché de MSAL', () => {
    localStorage.setItem('bd.profile.photo.oid-1', 'data:image/png;base64,abc');
    localStorage.setItem('bd.profile.work.oid-1', '{"preferAssignedOnly":true}');
    localStorage.setItem('bd.accessibility', '{"textStep":2}');
    sessionStorage.setItem('bd.profile.photo.oid-2', 'data:image/png;base64,def');
    sessionStorage.setItem('msal.token.keys', 'y');

    clearUserData();

    expect(localStorage.getItem('bd.profile.photo.oid-1')).toBeNull();
    expect(localStorage.getItem('bd.profile.work.oid-1')).toBeNull();
    expect(sessionStorage.getItem('bd.profile.photo.oid-2')).toBeNull();
    expect(localStorage.getItem('bd.accessibility')).toBe('{"textStep":2}');
    expect(sessionStorage.getItem('msal.token.keys')).toBe('y');
  });
});
