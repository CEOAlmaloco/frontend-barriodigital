/** Duración legible de un intervalo en segundos. null queda vacío: un tiempo que no se calculó no se muestra como cero. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) {
    return '';
  }
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) {
    return `${days} d ${hours} h`;
  }
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (minutes > 0) {
    return `${minutes} min`;
  }
  return `${total} s`;
}

/** Tiempo transcurrido desde un instante, en la unidad mayor: «hace 3 h», «hace 1 día». */
export function formatElapsed(since: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 1000));
  if (Number.isNaN(seconds)) {
    return '';
  }
  const days = Math.floor(seconds / 86400);
  if (days > 0) {
    return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  }
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) {
    return `hace ${hours} h`;
  }
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `hace ${minutes} min` : 'hace un momento';
}
