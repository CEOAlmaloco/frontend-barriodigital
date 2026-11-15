import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it('muestra KB enteros bajo 1 MB, con 1 KB como mínimo', () => {
    expect(formatFileSize(120)).toBe('1 KB');
    expect(formatFileSize(845 * 1024)).toBe('845 KB');
  });

  it('muestra MB con dos decimales y coma decimal', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1,00 MB');
    expect(formatFileSize(1.84 * 1024 * 1024)).toBe('1,84 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5,00 MB');
  });
});
