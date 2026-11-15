import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { RequestImageFieldComponent } from './request-image-field.component';

@Component({
  imports: [RequestImageFieldComponent],
  template: `
    <app-request-image-field
      [file]="file()"
      [processing]="processing()"
      [error]="error()"
      [disabled]="disabled()"
      (fileSelected)="selected.push($event)"
      (removed)="removedCount = removedCount + 1"
    />
  `,
})
class HostComponent {
  readonly file = signal<File | null>(null);
  readonly processing = signal(false);
  readonly error = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly selected: File[] = [];
  removedCount = 0;
}

describe('RequestImageFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;
  let createUrl: ReturnType<typeof vi.spyOn>;
  let revokeUrl: ReturnType<typeof vi.spyOn>;

  const image = (name = 'bache.jpg', size = 1.84 * 1024 * 1024) => {
    const file = new File(['x'], name, { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const picker = () => element.querySelector<HTMLInputElement>('input[type="file"]')!;
  const button = (label: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes(label),
    );
  const choosePicker = (file: File) => {
    Object.defineProperty(picker(), 'files', { value: [file], configurable: true });
    picker().dispatchEvent(new Event('change'));
  };

  beforeEach(async () => {
    createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vista-previa');
    revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await settle();
  });

  afterEach(() => vi.restoreAllMocks());

  it('sin imagen ofrece un botón descrito por el formato y la advertencia, con el input nativo oculto', () => {
    const choose = button('Elegir imagen')!;
    const describedBy = choose.getAttribute('aria-describedby')!.split(' ');
    const [hint, caution] = describedBy.map((id) => element.querySelector(`#${id}`));

    expect(describedBy).toHaveLength(2);
    expect(hint?.textContent).toContain('JPEG, PNG o WebP de hasta 5 MB');
    expect(caution?.classList).toContain('image-field__caution');
    expect(caution?.textContent).toMatch(/rostros/i);
    expect(caution?.textContent).toMatch(/patentes/i);
    expect(picker().hidden).toBe(true);
    expect(picker().accept).toBe('image/jpeg,image/png,image/webp');
    expect(element.querySelector('img')).toBeNull();
  });

  it('el botón abre el selector del sistema y el archivo elegido se entrega al formulario', () => {
    const click = vi.spyOn(picker(), 'click').mockImplementation(() => undefined);
    button('Elegir imagen')!.click();
    expect(click).toHaveBeenCalled();

    const file = image();
    choosePicker(file);
    expect(host.selected).toEqual([file]);
  });

  it('cancelar el selector no cambia nada', () => {
    Object.defineProperty(picker(), 'files', { value: [], configurable: true });
    picker().dispatchEvent(new Event('change'));
    expect(host.selected).toEqual([]);
  });

  it('con imagen muestra miniatura, nombre, peso y las acciones Cambiar y Quitar', async () => {
    host.file.set(image('bache-los-aromos.jpg'));
    await settle();

    const thumb = element.querySelector<HTMLButtonElement>('button.image-field__thumb')!;
    expect(thumb.getAttribute('aria-label')).toBe('Ampliar la imagen seleccionada');
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe('blob:vista-previa');
    expect(thumb.querySelector('img')?.alt).toBe('');
    expect(element.querySelector('.image-field__name')?.textContent).toBe('bache-los-aromos.jpg');
    expect(element.querySelector('.image-field__size')?.textContent).toBe('1,84 MB');
    expect(button('Cambiar')!.getAttribute('aria-label')).toBe('Cambiar imagen');
    expect(button('Quitar')!.getAttribute('aria-label')).toBe('Quitar imagen');
    expect(button('Elegir imagen')).toBeUndefined();
    expect(element.textContent).toContain('Imagen lista: bache-los-aromos.jpg, 1,84 MB.');

    const click = vi.spyOn(picker(), 'click').mockImplementation(() => undefined);
    button('Cambiar')!.click();
    expect(click).toHaveBeenCalled();
  });

  describe('vista ampliada', () => {
    let overlay: HTMLElement;
    const dialogImage = () => overlay.querySelector<HTMLImageElement>('.image-field__preview img');
    const thumb = () => element.querySelector<HTMLButtonElement>('button.image-field__thumb')!;

    beforeEach(async () => {
      overlay = TestBed.inject(OverlayContainer).getContainerElement();
      host.file.set(image('bache-los-aromos.jpg'));
      await settle();
    });

    afterEach(() => {
      TestBed.inject(MatDialog).closeAll();
      overlay.replaceChildren();
    });

    it('la miniatura abre la imagen completa con un nombre accesible y la cierra con Cerrar', async () => {
      thumb().click();
      await settle();

      expect(overlay.querySelector('h2')?.textContent).toBe('Imagen seleccionada');
      expect(dialogImage()?.getAttribute('src')).toBe('blob:vista-previa');
      expect(dialogImage()?.alt).toBe('Imagen seleccionada: bache-los-aromos.jpg');

      const dialog = TestBed.inject(MatDialog);
      const closed = firstValueFrom(dialog.afterAllClosed);
      overlay.querySelector<HTMLButtonElement>('[mat-dialog-close]')!.click();
      await closed;
      expect(dialog.openDialogs).toHaveLength(0);
    });

    it('un segundo clic no abre otro diálogo', async () => {
      thumb().click();
      thumb().click();
      await settle();
      expect(overlay.querySelectorAll('.image-field__preview')).toHaveLength(1);
    });

    it('se cierra si el campo deja de existir', async () => {
      thumb().click();
      await settle();
      const dialog = TestBed.inject(MatDialog);
      const closed = firstValueFrom(dialog.afterAllClosed);
      fixture.destroy();
      await closed;
      expect(dialog.openDialogs).toHaveLength(0);
    });
  });

  it('Quitar avisa al formulario y la URL temporal se libera al quitar la imagen', async () => {
    host.file.set(image());
    await settle();
    button('Quitar')!.click();
    expect(host.removedCount).toBe(1);

    host.file.set(null);
    await settle();
    expect(revokeUrl).toHaveBeenCalledWith('blob:vista-previa');
    expect(element.querySelector('img')).toBeNull();
  });

  it('libera la URL anterior al cambiar de imagen', async () => {
    host.file.set(image('uno.jpg'));
    await settle();
    createUrl.mockReturnValue('blob:segunda');
    host.file.set(image('dos.jpg'));
    await settle();

    expect(revokeUrl).toHaveBeenCalledWith('blob:vista-previa');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('blob:segunda');
  });

  it('el foco pasa a Cambiar cuando la imagen queda lista y vuelve a Elegir al quitarla', async () => {
    button('Elegir imagen')!.focus();
    choosePicker(image());
    host.processing.set(true);
    await settle();
    expect(element.textContent).toContain('Procesando imagen…');

    host.processing.set(false);
    host.file.set(image());
    await settle();
    expect(document.activeElement).toBe(button('Cambiar'));

    button('Quitar')!.click();
    host.file.set(null);
    await settle();
    expect(document.activeElement).toBe(button('Elegir imagen'));
  });

  it('mientras procesa, el botón queda deshabilitado', async () => {
    host.processing.set(true);
    await settle();
    expect(button('Elegir imagen')!.disabled).toBe(true);
  });

  it('el error se anuncia y queda asociado al botón', async () => {
    host.error.set('La imagen no puede superar 5 MB.');
    await settle();

    const alert = element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('La imagen no puede superar 5 MB.');
    expect(button('Elegir imagen')!.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('durante el envío no se puede cambiar ni quitar la imagen', async () => {
    host.file.set(image());
    host.disabled.set(true);
    await settle();
    expect(button('Cambiar')!.disabled).toBe(true);
    expect(button('Quitar')!.disabled).toBe(true);
  });
});
