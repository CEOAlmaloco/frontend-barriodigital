import { TestBed } from '@angular/core/testing';

import { ReportSeries } from '../../../shared/models/report.model';
import { ReportTrendChartComponent } from './report-trend-chart.component';

describe('ReportTrendChartComponent', () => {
  function render(series: ReportSeries) {
    const fixture = TestBed.createComponent(ReportTrendChartComponent);
    fixture.componentRef.setInput('series', series);
    fixture.componentRef.setInput('period', 'las últimas 24 horas');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const hourly = (counts: number[], start = Date.UTC(2026, 10, 12, 18)): ReportSeries => ({
    bucket: 'HOUR',
    points: counts.map((count, index) => ({
      bucketStart: new Date(start + index * 3_600_000).toISOString(),
      count,
    })),
  });

  it('dibuja una barra por tramo a escala y resume el gráfico para lectores de pantalla', () => {
    const element = render(hourly([2, 6, 0, 3]));
    const bars = Array.from(element.querySelectorAll<HTMLElement>('.trend__bar'));
    expect(bars.map((bar) => bar.style.height)).toEqual(['25%', '75%', '0%', '37.5%']);
    expect(bars.at(-1)?.classList).toContain('trend__bar--current');
    expect(element.querySelector('.trend__plot')?.getAttribute('aria-label')).toBe(
      '11 trámites ingresados en las últimas 24 horas. Máximo: 6, 12 nov, 16:00.',
    );
    expect(element.querySelector('.trend__x')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('explica en la leyenda los tramos completos y el tramo en curso, con su mismo rayado', () => {
    const element = render(hourly([2, 6]));
    const items = Array.from(element.querySelectorAll('.trend__legend li'));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Horas completas',
      'Hora en curso',
    ]);
    expect(items[1].querySelector('.trend__swatch--current')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('repite los valores en una tabla y marca el tramo en curso', () => {
    const element = render(hourly([2, 6]));
    const rows = Array.from(element.querySelectorAll('tbody tr')).map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toEqual(['12 nov, 15:002', '12 nov, 16:00 (en curso)6']);
    expect(element.querySelector('summary')?.textContent?.trim()).toBe('Ver como tabla');
  });

  it('en la tabla distingue con el desplazamiento UTC la hora que se repite', () => {
    const element = render(hourly([1, 1], Date.UTC(2026, 3, 5, 2)));
    const cells = Array.from(element.querySelectorAll('tbody td:first-child')).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(cells).toEqual(['4 abr, 23:00 (UTC−3)', '4 abr, 23:00 (UTC−4) (en curso)']);
  });

  it('sin altas muestra un estado vacío en vez de un gráfico en cero', () => {
    const element = render(hourly([0, 0, 0]));
    expect(element.querySelector('.trend__plot')).toBeNull();
    expect(element.textContent).toContain('Sin trámites ingresados');
  });
});
