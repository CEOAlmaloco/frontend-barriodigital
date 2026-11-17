import { OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';

import { RequestsService } from '../requests.service';
import { RequestCommentPhotoComponent } from './request-comment-photo.component';

describe('RequestCommentPhotoComponent', () => {
  let fixture: ComponentFixture<RequestCommentPhotoComponent>;
  let element: HTMLElement;
  let getCommentAttachment: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.spyOn>;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const render = async (response: () => Observable<Blob>) => {
    getCommentAttachment = vi.fn(response);
    TestBed.configureTestingModule({
      imports: [RequestCommentPhotoComponent],
      providers: [{ provide: RequestsService, useValue: { getCommentAttachment } }],
    });
    fixture = TestBed.createComponent(RequestCommentPhotoComponent);
    fixture.componentRef.setInput('requestId', 'req-1');
    fixture.componentRef.setInput('commentId', 'ev-7');
    fixture.componentRef.setInput('context', 'María José Fuentes, 12/11/2026 08:03');
    element = fixture.nativeElement;
    await settle();
  };

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foto-comentario');
    revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().replaceChildren();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mientras carga reserva el espacio y lo anuncia', async () => {
    await render(() => new Subject<Blob>());
    expect(element.querySelector('.comment-photo__skeleton')?.getAttribute('role')).toBe('status');
    expect(element.textContent).toContain('Cargando la foto del comentario.');
  });

  it('muestra la miniatura con un nombre que dice de quién y cuándo es', async () => {
    await render(() => of(new Blob(['jpg'], { type: 'image/jpeg' })));

    expect(getCommentAttachment).toHaveBeenCalledWith('req-1', 'ev-7');
    const thumb = element.querySelector<HTMLButtonElement>('button.comment-photo__thumb')!;
    expect(thumb.getAttribute('aria-label')).toBe(
      'Ampliar la foto del comentario, María José Fuentes, 12/11/2026 08:03',
    );
    expect(thumb.querySelector('img')?.getAttribute('src')).toBe('blob:foto-comentario');
    expect(thumb.querySelector('img')?.alt).toBe('');
  });

  it('la vista ampliada trae el contexto y la descarga, y no se abre dos veces', async () => {
    await render(() => of(new Blob(['jpg'], { type: 'image/jpeg' })));
    const thumb = element.querySelector<HTMLButtonElement>('button.comment-photo__thumb')!;
    thumb.click();
    thumb.click();
    await settle();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelectorAll('.image-preview')).toHaveLength(1);
    expect(overlay.querySelector('h2')?.textContent).toBe('Foto del comentario');
    expect(overlay.querySelector('.image-preview__caption')?.textContent).toContain(
      'María José Fuentes',
    );
    expect(overlay.querySelector('a[download]')?.getAttribute('download')).toBe('comentario.jpg');

    const dialog = TestBed.inject(MatDialog);
    const closed = firstValueFrom(dialog.afterAllClosed);
    fixture.destroy();
    await closed;
    expect(revokeUrl).toHaveBeenCalledWith('blob:foto-comentario');
  });

  it('si falla ofrece reintentar; un archivo que no es imagen también es un error', async () => {
    let attempt = 0;
    await render(() =>
      ++attempt === 1
        ? throwError(() => new Error('red'))
        : attempt === 2
          ? of(new Blob(['x'], { type: 'text/html' }))
          : of(new Blob(['png'], { type: 'image/png' })),
    );
    const retry = () =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Reintentar',
      )!;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar la foto.',
    );

    retry().click();
    await settle();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();

    retry().click();
    await settle();
    expect(element.querySelector('button.comment-photo__thumb')).not.toBeNull();
    expect(getCommentAttachment).toHaveBeenCalledTimes(3);
  });

  it('con IntersectionObserver espera a que la foto se acerque a la pantalla', async () => {
    let notify!: (entries: Partial<IntersectionObserverEntry>[]) => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          notify = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    await render(() => of(new Blob(['png'], { type: 'image/png' })));
    expect(getCommentAttachment).not.toHaveBeenCalled();

    notify([{ isIntersecting: true }]);
    await settle();
    expect(getCommentAttachment).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalled();
  });
});
