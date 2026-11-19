import {
  DestroyRef,
  Directive,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

/** Sin ResizeObserver (tests, navegadores antiguos) se estima por largo. */
const FALLBACK_LENGTH = 72;

/**
 * Indica si un texto recortado con line-clamp por CSS quedó cortado, para ofrecer "Ver más" solo
 * cuando hace falta. Mide de nuevo al cambiar el ancho, la escala de texto o el contenido.
 */
@Directive({
  selector: '[appTextClamp]',
  exportAs: 'textClamp',
})
export class TextClampDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly measured = signal<boolean | null>(null);

  readonly text = input.required<string>({ alias: 'appTextClamp' });

  readonly clamped = computed(() => this.measured() ?? this.text().trim().length > FALLBACK_LENGTH);

  constructor() {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => this.measure());
    observer.observe(this.element.nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    afterRenderEffect(() => {
      this.text();
      untracked(() => this.measure());
    });
  }

  private measure(): void {
    const element = this.element.nativeElement;
    // Oculto (por ejemplo, las tarjetas en escritorio) no hay medida: se conserva la anterior
    if (!element.clientHeight) {
      return;
    }
    this.measured.set(element.scrollHeight - element.clientHeight > 1);
  }
}
