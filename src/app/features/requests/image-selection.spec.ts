import {
  ImagePreparationError,
  ImageSelection,
  MAX_IMAGE_BYTES,
  prepareImage,
} from './image-selection';

const file = (type = 'image/jpeg', size = 1024, name = 'foto.jpg') => {
  const image = new File(['x'], name, { type });
  Object.defineProperty(image, 'size', { value: size });
  return image;
};

const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() });

describe('prepareImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve el mismo JPEG o PNG si cumple los límites', async () => {
    const decoded = bitmap(4000, 3000);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => decoded),
    );
    const image = file();

    await expect(prepareImage(image)).resolves.toBe(image);
    expect(decoded.close).toHaveBeenCalled();
  });

  it.each([
    ['más de 5 MB', file('image/jpeg', MAX_IMAGE_BYTES + 1), 'La imagen no puede superar 5 MB.'],
    ['un formato no admitido', file('image/gif'), 'Adjunta una imagen JPEG, PNG o WebP.'],
  ])('rechaza %s sin leer el archivo', async (_, image, message) => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);

    await expect(prepareImage(image)).rejects.toEqual(new ImagePreparationError(message));
    expect(decode).not.toHaveBeenCalled();
  });

  it.each([
    ['un lado de más de 6000 px', bitmap(6001, 100)],
    ['más de 12 MP', bitmap(4000, 3001)],
  ])('rechaza %s y libera el bitmap', async (_, decoded) => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => decoded),
    );

    await expect(prepareImage(file())).rejects.toThrow(
      'La imagen supera las dimensiones permitidas.',
    );
    expect(decoded.close).toHaveBeenCalled();
  });

  it('un archivo que no se puede decodificar pide uno válido', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode');
      }),
    );

    await expect(prepareImage(file())).rejects.toThrow(
      'No se pudo leer la imagen. Elige un archivo JPEG, PNG o WebP válido.',
    );
  });
});

describe('ImageSelection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marca el procesamiento y deja el archivo listo', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap(800, 600)),
    );
    const selection = new ImageSelection();
    const image = file();

    const done = selection.select(image);
    expect(selection.processing()).toBe(true);
    await done;

    expect(selection.processing()).toBe(false);
    expect(selection.file()).toBe(image);
    expect(selection.error()).toBeNull();
  });

  it('un formato inválido muestra el error sin pasar por el procesamiento', async () => {
    const selection = new ImageSelection();

    await selection.select(file('image/gif'));

    expect(selection.processing()).toBe(false);
    expect(selection.file()).toBeNull();
    expect(selection.error()).toBe('Adjunta una imagen JPEG, PNG o WebP.');
  });

  it('descarta una selección que termina después de otra más reciente', async () => {
    let finishFirst!: (value: unknown) => void;
    vi.stubGlobal(
      'createImageBitmap',
      vi
        .fn()
        .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
        .mockImplementationOnce(async () => bitmap(800, 600)),
    );
    const selection = new ImageSelection();
    const first = file('image/jpeg', 1024, 'primera.jpg');
    const second = file('image/jpeg', 1024, 'segunda.jpg');

    const pending = selection.select(first);
    await selection.select(second);
    finishFirst(bitmap(800, 600));
    await pending;

    expect(selection.file()).toBe(second);
  });

  it('clear descarta la selección en curso y reject marca un error externo', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => new Promise((resolve) => (finish = resolve))),
    );
    const selection = new ImageSelection();

    const pending = selection.select(file());
    selection.clear();
    finish(bitmap(800, 600));
    await pending;
    expect(selection.file()).toBeNull();
    expect(selection.processing()).toBe(false);

    selection.reject('La imagen supera el tamaño permitido.');
    expect(selection.error()).toBe('La imagen supera el tamaño permitido.');
  });
});
