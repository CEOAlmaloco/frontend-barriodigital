import { signal } from '@angular/core';

import { ACCEPTED_IMAGE_TYPES } from './requests.constants';

/** Mismos límites que valida requests al sanitizar (EP3-64, sección 1). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_DIMENSION = 6000;

const UNREADABLE = 'No se pudo leer la imagen. Elige un archivo JPEG, PNG o WebP válido.';

export class ImagePreparationError extends Error {}

/**
 * Valida la imagen antes de subirla y convierte WebP a PNG, porque requests solo acepta JPEG y PNG.
 * Rechaza siempre con un ImagePreparationError cuyo mensaje se puede mostrar.
 */
export async function prepareImage(file: File): Promise<File> {
  const invalid = fileError(file);
  if (invalid) {
    throw new ImagePreparationError(invalid);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePreparationError(UNREADABLE);
  }
  let prepared: File;
  try {
    if (
      bitmap.width <= 0 ||
      bitmap.height <= 0 ||
      bitmap.width > MAX_IMAGE_DIMENSION ||
      bitmap.height > MAX_IMAGE_DIMENSION ||
      bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
    ) {
      throw new ImagePreparationError('La imagen supera las dimensiones permitidas.');
    }
    prepared = file.type === 'image/webp' ? await webpToPng(bitmap) : file;
  } catch (error: unknown) {
    throw error instanceof ImagePreparationError ? error : new ImagePreparationError(UNREADABLE);
  } finally {
    bitmap.close();
  }
  if (prepared.size > MAX_IMAGE_BYTES) {
    throw new ImagePreparationError('La imagen procesada no puede superar 5 MB.');
  }
  return prepared;
}

/** Peso y formato se revisan sin leer el archivo. */
function fileError(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen no puede superar 5 MB.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Adjunta una imagen JPEG, PNG o WebP.';
  return null;
}

/**
 * Estado del campo de imagen de un formulario. Una selección que termina después de otra más reciente, o de
 * quitar la imagen, se descarta.
 */
export class ImageSelection {
  readonly file = signal<File | null>(null);
  readonly processing = signal(false);
  readonly error = signal<string | null>(null);
  private current = 0;

  async select(file: File): Promise<void> {
    const selection = ++this.current;
    this.file.set(null);
    const invalid = fileError(file);
    this.error.set(invalid);
    this.processing.set(!invalid);
    if (invalid) {
      return;
    }
    try {
      const prepared = await prepareImage(file);
      if (selection === this.current) {
        this.file.set(prepared);
      }
    } catch (error: unknown) {
      if (selection === this.current) {
        this.error.set(error instanceof Error ? error.message : UNREADABLE);
      }
    } finally {
      if (selection === this.current) {
        this.processing.set(false);
      }
    }
  }

  clear(): void {
    this.current += 1;
    this.file.set(null);
    this.error.set(null);
    this.processing.set(false);
  }

  /** Error que no viene de la selección, como el 413 del servidor; se borra al elegir o quitar la imagen. */
  reject(message: string): void {
    this.error.set(message);
  }
}

function webpToPng(bitmap: ImageBitmap): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return Promise.reject(new Error('Sin contexto 2D'));
  }
  context.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], 'evidencia.png', { type: 'image/png' }));
      } else {
        reject(new Error('Sin PNG'));
      }
    }, 'image/png');
  });
}
