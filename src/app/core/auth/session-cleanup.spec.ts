import { afterEach, describe, expect, it } from 'vitest';

import { clearBrowserSessionData } from './session-cleanup';

describe('clearBrowserSessionData', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('borra tokens MSAL y foto/trabajo de perfil, y deja accesibilidad', () => {
    localStorage.setItem('msal.account.keys', 'x');
    localStorage.setItem('bd.profile.photo.oid-1', 'data:image/png;base64,abc');
    localStorage.setItem('bd.profile.work.oid-1', '{"preferAssignedOnly":true}');
    localStorage.setItem('bd.accessibility', '{"textStep":2}');
    sessionStorage.setItem('msal.token.keys', 'y');
    sessionStorage.setItem('bd.profile.photo.oid-2', 'data:image/png;base64,def');

    clearBrowserSessionData();

    expect(localStorage.getItem('msal.account.keys')).toBeNull();
    expect(localStorage.getItem('bd.profile.photo.oid-1')).toBeNull();
    expect(localStorage.getItem('bd.profile.work.oid-1')).toBeNull();
    expect(localStorage.getItem('bd.accessibility')).toBe('{"textStep":2}');
    expect(sessionStorage.getItem('msal.token.keys')).toBeNull();
    expect(sessionStorage.getItem('bd.profile.photo.oid-2')).toBeNull();
  });
});
