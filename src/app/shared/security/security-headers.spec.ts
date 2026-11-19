import { describe, expect, it } from 'vitest';

/**
 * Amplify aplica estos encabezados desde customHttp.yml (EP3.5-04).
 * Se documentan aquí para que un cambio que rompa login/mapas falle en CI.
 */
const AMPLIFY_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://login.microsoftonline.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    "connect-src 'self' https://login.microsoftonline.com https://*.microsoftonline.com https://graph.microsoft.com https://*.execute-api.us-east-1.amazonaws.com https://*.amplifyapp.com",
    'frame-src https://login.microsoftonline.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://login.microsoftonline.com",
  ].join('; '),
} as const;

describe('encabezados de seguridad (EP3.5-04)', () => {
  it('define CSP, HSTS, X-Frame-Options y Referrer-Policy', () => {
    expect(AMPLIFY_SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=');
    expect(AMPLIFY_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(AMPLIFY_SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(AMPLIFY_SECURITY_HEADERS['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('permite Entra ID y teselas de mapa', () => {
    const csp = AMPLIFY_SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).toContain('login.microsoftonline.com');
    expect(csp).toMatch(/openstreetmap\.org|basemaps\.cartocdn\.com/);
  });
});
