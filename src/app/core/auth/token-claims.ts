export interface AccessTokenClaims {
  roles?: string[];
}

/** Lee el payload de un JWT sin validar la firma. La firma la valida el BFF; aquí solo se usa para la UI. */
export function decodeJwtPayload(token: string): AccessTokenClaims | null {
  const payload = token.split('.')[1];

  if (!payload) {
    return null;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AccessTokenClaims;
  } catch {
    return null;
  }
}
