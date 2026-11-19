import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';

let nextId = 0;

/** Debajo y centrado; si no cabe, arriba, y luego alineado a un borde. */
const POSITIONS: ConnectedPosition[] = [
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
];

/**
 * Ayuda breve junto a un dato. Es un toggletip y no un tooltip: se abre con clic, toque, Enter o Espacio, porque
 * en un teléfono no hay hover, y se cierra con Escape o con un clic fuera (WCAG 1.4.13). El foco queda en el
 * botón y el texto se anuncia al abrir.
 */
@Component({
  selector: 'app-info-toggletip',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, MatIcon],
  template: `
    <button
      #button
      type="button"
      class="toggletip__button"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [attr.aria-label]="'Más información: ' + topic()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? id : null"
      (click)="toggle()"
    >
      <mat-icon aria-hidden="true">info</mat-icon>
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayPush]="true"
      (overlayOutsideClick)="closeFromOutside($event)"
      (overlayKeydown)="closeOnEscape($event)"
      (detach)="open.set(false)"
    >
      <p class="toggletip__bubble" [id]="id" role="status">{{ text() }}</p>
    </ng-template>
  `,
  styleUrl: './info-toggletip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoToggletipComponent {
  /** Completa el nombre del botón: «Más información: {topic}». */
  readonly topic = input.required<string>();
  readonly text = input.required<string>();

  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  protected readonly id = `info-toggletip-${nextId++}`;
  protected readonly positions = POSITIONS;
  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  /** El clic en el propio botón también es "fuera" del globo: lo resuelve toggle(). */
  protected closeFromOutside(event: MouseEvent): void {
    if (!this.button().nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  /** El globo es el overlay superior, así que Escape lo cierra sin cerrar un diálogo que lo contenga. */
  protected closeOnEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.open.set(false);
      this.button().nativeElement.focus();
    }
  }
}
