const KB = 1024;
const MB = KB * KB;

const kilobytes = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const megabytes = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Tamaño legible en base 1024, la misma de los límites de carga ("5 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < MB) {
    return `${kilobytes.format(Math.max(1, Math.round(bytes / KB)))} KB`;
  }
  return `${megabytes.format(bytes / MB)} MB`;
}
