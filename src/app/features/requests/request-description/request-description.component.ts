import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TextClampDirective } from '../../../shared/directives/text-clamp.directive';

/** Descripción recortada a pocas líneas; "Ver más" aparece solo si el texto quedó cortado. */
@Component({
  selector: 'app-request-description',
  imports: [TextClampDirective],
  template: `
    <p class="description__text" [appTextClamp]="text()" #clamp="textClamp">{{ text() }}</p>
    @if (clamp.clamped()) {
      <button
        type="button"
        class="description__more"
        [attr.aria-label]="'Ver la descripción completa del trámite ' + requestName()"
        (click)="expand.emit()"
      >
        Ver más
      </button>
    }
  `,
  styleUrl: './request-description.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--description-lines]': 'lines()' },
})
export class RequestDescriptionComponent {
  readonly text = input.required<string>();
  /** Folio o id, para la etiqueta accesible de "Ver más". */
  readonly requestName = input.required<string>();
  readonly lines = input(2);

  readonly expand = output<void>();
}
