import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { RequestActivity, RequestsService } from '../requests.service';
import {
  CommentFailure,
  RequestCommentFormComponent,
  commentFailure,
} from './request-comment-form.component';

@Component({
  imports: [RequestCommentFormComponent],
  template: `
    <app-request-comment-form
      requestId="req-1"
      [remaining]="remaining()"
      (saved)="saved.push($event)"
      (failed)="failed.push($event)"
      (cancelled)="cancelled = cancelled + 1"
    />
  `,
})
class HostComponent {
  readonly remaining = signal(20);
  readonly saved: RequestActivity[] = [];
  readonly failed: CommentFailure[] = [];
  cancelled = 0;
}

const activity = { requestId: 'req-1', eventos: [] } as unknown as RequestActivity;
const httpError = (status: number) => new HttpErrorResponse({ status });

describe('RequestCommentFormComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let element: HTMLElement;
  let addComment: ReturnType<typeof vi.fn>;

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const textArea = () => element.querySelector<HTMLTextAreaElement>('textarea')!;
  const type = async (value: string) => {
    textArea().value = value;
    textArea().dispatchEvent(new Event('input'));
    await settle();
  };
  const button = (label: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes(label),
    )!;
  const submit = async () => {
    button('Enviar comentario').click();
    await settle();
  };
  const pickImage = async (file = new File(['x'], 'bache.jpg', { type: 'image/jpeg' })) => {
    const picker = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });
    picker.dispatchEvent(new Event('change'));
    await settle();
    await settle();
    return file;
  };
  const alertText = () => element.querySelector('.comment-form__alert span')?.textContent?.trim();
  const imageError = () => element.querySelector('.image-field__error span')?.textContent?.trim();

  const render = async (response: () => Observable<RequestActivity> = () => of(activity)) => {
    addComment = vi.fn(response);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: RequestsService, useValue: { addComment } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await settle();
  };

  beforeEach(() => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })),
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:comentario');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('enfoca el comentario al abrirse y muestra la ayuda y el contador', async () => {
    await render();
    expect(document.activeElement).toBe(textArea());
    expect(element.textContent).toContain('Lo verán tú y el equipo municipal.');
    expect(element.querySelector('.comment-form__count')?.textContent?.trim()).toBe('0 / 500');
    expect(textArea().maxLength).toBe(500);
    expect(element.querySelector('app-request-image-field')?.classList).toContain(
      'image-field--compact',
    );

    await type('Se acumula agua');
    expect(element.querySelector('.comment-form__count')?.textContent?.trim()).toBe('15 / 500');
  });

  it('un texto vacío o con solo espacios no se envía y explica por qué', async () => {
    await render();
    await type('   ');
    await submit();

    expect(addComment).not.toHaveBeenCalled();
    expect(element.querySelector('mat-error')?.textContent).toContain('Escribe el comentario.');
    expect(textArea().getAttribute('aria-invalid')).toBe('true');
  });

  it('sin imagen envía el texto recortado, limpia el formulario y avisa al detalle', async () => {
    await render();
    await type('  Se acumula agua  ');
    await submit();

    expect(addComment).toHaveBeenCalledWith('req-1', 'Se acumula agua', null);
    expect(host.saved).toEqual([activity]);
    expect(textArea().value).toBe('');
  });

  it('con imagen la envía junto al texto', async () => {
    await render();
    await type('Foto de hoy');
    const image = await pickImage();
    await submit();

    expect(addComment).toHaveBeenCalledWith('req-1', 'Foto de hoy', image);
  });

  it('mientras envía bloquea el texto y anuncia el estado', async () => {
    const response = new Subject<RequestActivity>();
    await render(() => response);
    await type('Se acumula agua');
    await submit();

    expect(textArea().readOnly).toBe(true);
    const send = button('Enviar comentario');
    expect(send.getAttribute('aria-busy')).toBe('true');
    expect(send.querySelector('.mat-mdc-progress-spinner')).not.toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Enviando comentario.',
    );
    expect(button('Cancelar').disabled).toBe(true);
    send.click();
    expect(addComment).toHaveBeenCalledOnce();
  });

  describe('errores del servidor', () => {
    it('un 400 sin imagen se muestra en el formulario y conserva el texto', async () => {
      await render(() => throwError(() => httpError(400)));
      await type('Se acumula agua');
      await submit();

      expect(alertText()).toBe(
        'No se pudo enviar el comentario. Revisa el texto e inténtalo de nuevo.',
      );
      expect(textArea().value).toBe('Se acumula agua');
      expect(host.failed).toEqual([{ message: alertText(), requiresReload: false }]);
    });

    it('un 400 con imagen no culpa a la imagen: va al formulario y conserva texto y foto', async () => {
      await render(() => throwError(() => httpError(400)));
      await type('Foto de hoy');
      await pickImage();
      await submit();

      expect(alertText()).toBe(
        'No se pudo enviar el comentario. Revisa el texto o prueba con otra imagen.',
      );
      expect(imageError()).toBeUndefined();
      expect(textArea().value).toBe('Foto de hoy');
      expect(element.querySelector('.image-field__name')?.textContent).toBe('bache.jpg');
    });

    it('un 413 se muestra en la imagen y bloquea el envío hasta cambiarla o quitarla', async () => {
      await render(() => throwError(() => httpError(413)));
      await type('Foto de hoy');
      await pickImage();
      await submit();

      expect(imageError()).toBe('La imagen supera el tamaño permitido. Elige otra o quítala.');
      expect(alertText()).toBeUndefined();
      expect(button('Enviar comentario').disabled).toBe(true);

      button('Quitar').click();
      await settle();
      expect(imageError()).toBeUndefined();
      expect(button('Enviar comentario').disabled).toBe(false);
    });

    it('un 409 pide recargar el trámite', async () => {
      await render(() => throwError(() => httpError(409)));
      await type('Se acumula agua');
      await submit();

      expect(host.failed).toEqual([
        { message: 'El trámite ya no admite comentarios.', requiresReload: true },
      ]);
    });
  });

  it.each([
    [0, false, 'No se pudo enviar el comentario. Revisa tu conexión e inténtalo de nuevo.', false],
    [403, false, 'Tu cuenta no puede comentar este trámite.', true],
    [404, false, 'El trámite ya no está disponible.', true],
    [503, false, 'El servicio de trámites no responde. Inténtalo en unos minutos.', false],
    [500, true, 'No se pudo enviar el comentario. Inténtalo de nuevo.', false],
  ])('commentFailure(%i)', (status, withImage, message, requiresReload) => {
    expect(commentFailure(httpError(status), withImage)).toEqual({
      message,
      requiresReload,
      target: 'form',
    });
  });

  it('muestra cuántos comentarios quedan solo cerca del tope, en singular o plural', async () => {
    await render();
    const notice = () => element.querySelector('.comment-form__remaining')?.textContent?.trim();
    expect(notice()).toBeUndefined();

    host.remaining.set(5);
    await settle();
    expect(notice()).toBe('Puedes agregar 5 comentarios más.');

    host.remaining.set(1);
    await settle();
    expect(notice()).toBe('Puedes agregar 1 comentario más.');
  });

  it('Cancelar avisa al detalle', async () => {
    await render();
    button('Cancelar').click();
    expect(host.cancelled).toBe(1);
  });
});
