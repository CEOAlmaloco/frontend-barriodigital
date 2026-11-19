import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Silueta de un bloque de reportes mientras llega su fuente. La región que lo contiene marca aria-busy. */
@Component({
  selector: 'app-report-skeleton',
  template: `
    @switch (shape()) {
      @case ('tile') {
        <span class="bone bone--short"></span>
        <span class="bone bone--value"></span>
        <span class="bone bone--medium"></span>
      }
      @case ('chart') {
        <span class="bone bone--medium"></span>
        <span class="bone bone--chart"></span>
      }
      @default {
        <span class="bone bone--medium"></span>
        @for (width of listWidths; track $index) {
          <span class="bone" [style.width.%]="width"></span>
        }
      }
    }
  `,
  styleUrl: './report-skeleton.component.scss',
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportSkeletonComponent {
  readonly shape = input<'tile' | 'chart' | 'list'>('list');

  protected readonly listWidths = [90, 72, 58, 44, 30];
}
