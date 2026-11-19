import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ReportSeries } from '../../../shared/models/report.model';
import { bucketLabels, formatCount, plural } from '../report-format';

const AXIS_STEPS = [4, 8, 12, 20, 40, 60, 80, 100, 200];

/** Tope del eje divisible en cuartos, para que las cuatro líneas guía caigan en enteros. */
function axisMax(value: number): number {
  return AXIS_STEPS.find((step) => step >= value) ?? Math.ceil(value / 100) * 100;
}

/**
 * Barras de altas por tramo, dibujadas con CSS para que sigan los tokens de los modos de contraste. El tramo
 * en curso va rayado y la tabla repite los valores para lectores de pantalla y para quien no distingue el gráfico.
 */
@Component({
  selector: 'app-report-trend-chart',
  templateUrl: './report-trend-chart.component.html',
  styleUrl: './report-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportTrendChartComponent {
  readonly series = input.required<ReportSeries>();
  /** Período dentro de una frase: «las últimas 24 horas». */
  readonly period = input.required<string>();

  protected readonly isHourly = computed(() => this.series().bucket === 'HOUR');
  protected readonly total = computed(() =>
    this.series().points.reduce((sum, point) => sum + point.count, 0),
  );
  protected readonly max = computed(() =>
    axisMax(Math.max(0, ...this.series().points.map((point) => point.count))),
  );
  protected readonly ticks = computed(() => {
    const max = this.max();
    return [0, 1, 2, 3, 4].map((step) => ({ value: (max * step) / 4, bottom: step * 25 }));
  });
  protected readonly bars = computed(() => {
    const { points } = this.series();
    const labels = bucketLabels(this.series());
    const hourly = this.isHourly();
    return points.map((point, index) => ({
      key: point.bucketStart,
      count: point.count,
      height: (point.count / this.max()) * 100,
      current: index === points.length - 1,
      axis: labels[index].axis,
      full: labels[index].full,
      // Horas: una etiqueta cada 3, y cada 6 en pantallas angostas.
      tick: !hourly || index % 3 === 0,
      minorTick: hourly && index % 6 !== 0,
    }));
  });
  protected readonly summary = computed(() => {
    const bars = this.bars();
    const peak = bars.reduce((best, bar) => (bar.count > best.count ? bar : best), bars[0]);
    return (
      `${plural(this.total(), 'trámite ingresado', 'trámites ingresados')} en ${this.period()}. ` +
      `Máximo: ${formatCount(peak.count)}, ${peak.full}.`
    );
  });
  protected readonly formatCount = formatCount;
}
