import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface AdminRateSample {
  /** Etiqueta corta del eje (hora:minuto:segundo). */
  label: string;
  /** Valor completo para tooltip. */
  full: string;
  series: readonly { key: string; value: number }[];
}

/**
 * Serie temporal compacta (SVG) para tasas muestreadas en sesión.
 * No inventa puntos: solo dibuja la muestra que recibe el padre.
 */
@Component({
  selector: 'app-admin-rate-chart',
  imports: [DecimalPipe],
  templateUrl: './admin-rate-chart.component.html',
  styleUrl: './admin-rate-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRateChartComponent {
  readonly samples = input.required<readonly AdminRateSample[]>();
  readonly emptyTitle = input('Sin datos');
  readonly emptyText = input('Esperando muestras.');
  readonly legend = input.required<readonly { key: string; label: string; color: string }[]>();

  private readonly width = 640;
  private readonly height = 180;
  private readonly pad = { top: 12, right: 12, bottom: 28, left: 40 };

  protected readonly max = computed(() => {
    const values = this.samples().flatMap((s) => s.series.map((p) => p.value));
    const peak = Math.max(0, ...values);
    if (peak <= 0) {
      return 1;
    }
    const step = peak <= 1 ? 0.25 : peak <= 5 ? 1 : peak <= 20 ? 5 : 10;
    return Math.ceil(peak / step) * step;
  });

  protected readonly paths = computed(() => {
    const samples = this.samples();
    if (samples.length < 2) {
      return [];
    }
    const keys = this.legend().map((item) => item.key);
    const innerW = this.width - this.pad.left - this.pad.right;
    const innerH = this.height - this.pad.top - this.pad.bottom;
    const max = this.max();
    const xAt = (i: number) =>
      this.pad.left + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW);
    const yAt = (v: number) => this.pad.top + innerH - (v / max) * innerH;

    return keys.map((key) => {
      const color = this.legend().find((item) => item.key === key)?.color ?? 'primary';
      const points = samples.map((sample, i) => {
        const value = sample.series.find((s) => s.key === key)?.value ?? 0;
        return `${xAt(i).toFixed(1)},${yAt(value).toFixed(1)}`;
      });
      return { key, color, d: `M ${points.join(' L ')}` };
    });
  });

  protected readonly yTicks = computed(() => {
    const max = this.max();
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: max * ratio,
      y: this.pad.top + (this.height - this.pad.top - this.pad.bottom) * (1 - ratio),
    }));
  });

  protected readonly xLabels = computed(() => {
    const samples = this.samples();
    if (!samples.length) {
      return [];
    }
    const innerW = this.width - this.pad.left - this.pad.right;
    const step = Math.max(1, Math.ceil(samples.length / 5));
    return samples
      .map((sample, i) => ({
        label: sample.label,
        x: this.pad.left + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW),
        show: i === 0 || i === samples.length - 1 || i % step === 0,
      }))
      .filter((item) => item.show);
  });

  protected readonly viewBox = `0 0 ${this.width} ${this.height}`;
}
