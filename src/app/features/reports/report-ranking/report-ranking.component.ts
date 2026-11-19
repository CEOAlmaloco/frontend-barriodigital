import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatCount } from '../report-format';

export interface RankingItem {
  label: string;
  value: number;
}

/** Valores por categoría con barras proporcionales al mayor. `ordered` lo anuncia como ranking. */
@Component({
  selector: 'app-report-ranking',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #listItems>
      @for (item of rows(); track $index) {
        <li class="ranking__item">
          <span class="ranking__label">
            @if (ordered()) {
              <span class="ranking__rank" aria-hidden="true">{{ $index + 1 }}.</span>
            }
            {{ item.label }}<span class="cdk-visually-hidden">: </span>
          </span>
          <span class="ranking__value">{{ item.display }}</span>
          <span class="ranking__track" aria-hidden="true">
            <span class="ranking__fill" [style.width.%]="item.width"></span>
          </span>
        </li>
      }
    </ng-template>
    @if (ordered()) {
      <ol class="ranking" [attr.aria-labelledby]="labelledBy()">
        <ng-container *ngTemplateOutlet="listItems" />
      </ol>
    } @else {
      <ul class="ranking" [attr.aria-labelledby]="labelledBy()">
        <ng-container *ngTemplateOutlet="listItems" />
      </ul>
    }
  `,
  styleUrl: './report-ranking.component.scss',
  host: { '[class.ranking--secondary]': 'tone() === "secondary"' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportRankingComponent {
  readonly items = input.required<readonly RankingItem[]>();
  readonly ordered = input(false);
  readonly tone = input<'primary' | 'secondary'>('primary');
  readonly labelledBy = input<string | null>(null);

  protected readonly rows = computed(() => {
    const max = Math.max(1, ...this.items().map((item) => item.value));
    return this.items().map((item) => ({
      ...item,
      display: formatCount(item.value),
      width: (item.value / max) * 100,
    }));
  });
}
