import { decodeJwtPayload } from './token-claims';

const toBase64Url = (value: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('decodeJwtPayload', () => {
  it('lee el payload en base64url, incluidos caracteres con tilde', () => {
    const claims = { name: 'Vecina Núñez', roles: ['Vecino'] };

    expect(decodeJwtPayload(`e30.${toBase64Url(JSON.stringify(claims))}.firma`)).toEqual(claims);
  });

  it('devuelve null si el token no es un JWT legible', () => {
    expect(decodeJwtPayload('no-es-un-jwt')).toBeNull();
    expect(decodeJwtPayload('e30.%%%.firma')).toBeNull();
  });
});
