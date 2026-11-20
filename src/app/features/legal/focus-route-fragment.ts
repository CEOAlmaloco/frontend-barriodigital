import { DOCUMENT } from '@angular/common';
import { Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Lleva el foco al elemento del fragmento (#seccion) al abrir la página o usar el índice. Mover solo el scroll
 * dejaría al lector de pantalla y al teclado donde estaban. Se llama en el constructor de la página.
 */
export function focusRouteFragment(): void {
  const document = inject(DOCUMENT);
  const injector = inject(Injector);
  inject(ActivatedRoute)
    .fragment.pipe(filter(Boolean), takeUntilDestroyed())
    .subscribe((id) => afterNextRender(() => document.getElementById(id)?.focus(), { injector }));
}
