import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AuditChange, ChangeMode } from '../audit-event-view';

const CAPTIONS: Readonly<Record<ChangeMode, string>> = {
  update: 'Cambios',
  create: 'Valores iniciales',
  delete: 'Valores al eliminar',
  result: 'Resultado de la operación',
};

/** `before` y `after` de una operación de configuración, con los campos modificados destacados. */
@Component({
  selector: 'app-audit-change-table',
  template: `
    <div class="change">
      <table class="change__table">
        <caption class="change__caption">
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Campo</th>
            @if (showBefore()) {
              <th scope="col">Antes</th>
            }
            @if (showAfter()) {
              <th scope="col">{{ change().mode === 'result' ? 'Resultado' : 'Después' }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of change().rows; track row.field) {
            <tr [class.change__row--changed]="row.changed">
              <th scope="row">
                {{ row.field }}
                @if (row.changed) {
                  <span class="cdk-visually-hidden">(modificado)</span>
                }
              </th>
              @if (showBefore()) {
                <td [class.change__old]="row.changed">
                  @if (row.before === null) {
                    <span class="change__none" aria-hidden="true">—</span>
                    <span class="cdk-visually-hidden">No aplica</span>
                  } @else {
                    {{ row.before }}
                  }
                </td>
              }
              @if (showAfter()) {
                <td [class.change__new]="row.changed">
                  @if (row.after === null) {
                    <span class="change__none" aria-hidden="true">—</span>
                    <span class="cdk-visually-hidden">No aplica</span>
                  } @else {
                    {{ row.after }}
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './audit-change-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditChangeTableComponent {
  readonly change = input.required<AuditChange>();

  protected readonly caption = computed(() => CAPTIONS[this.change().mode]);
  protected readonly showBefore = computed(() => this.change().mode !== 'create');
  protected readonly showAfter = computed(() => this.change().mode !== 'delete');
}
