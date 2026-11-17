import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';

import { REPORT_RANGES, ReportRange } from '../../../shared/models/report.model';
import { RequestDatePipe } from '../../requests/request-date.pipe';
import { RANGE_LABELS } from '../report-format';

/** Frescura de lo que está en pantalla: último evento aplicado por report y hora de la consulta. */
export interface ReportFreshness {
  dataAt: string | null;
  consultedAt: string;
}

/** Período, frescura y control del polling de una pestaña de reportería. */
@Component({
  selector: 'app-report-toolbar',
  imports: [MatButton, MatButtonToggle, MatButtonToggleGroup, MatIcon, RequestDatePipe],
  templateUrl: './report-toolbar.component.html',
  styleUrl: './report-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportToolbarComponent {
  readonly range = input.required<ReportRange>();
  readonly freshness = input.required<ReportFreshness | null>();
  readonly paused = input.required<boolean>();
  readonly intervalSeconds = input.required<number>();

  readonly rangeChange = output<ReportRange>();
  readonly togglePause = output<void>();
  readonly refresh = output<void>();

  protected readonly ranges = REPORT_RANGES;
  protected readonly rangeLabels = RANGE_LABELS;

  protected selectRange(range: ReportRange): void {
    if (range !== this.range()) {
      this.rangeChange.emit(range);
    }
  }
}
