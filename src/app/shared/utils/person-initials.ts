/** Hasta dos iniciales del nombre, para avatares. Un nombre vacío no tiene iniciales. */
export function personInitials(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('es-CL'))
    .join('');
}
