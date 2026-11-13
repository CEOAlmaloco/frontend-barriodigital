import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { ReportService } from '../../../core/report/report.service';
import { ReportKpis, ReportRange } from '../../../shared/models/report.model';
import { polledResource } from '../../../shared/utils/polled-resource';
import { formatClock } from '../../reports/report-format';
import { ReportKpiTilesComponent } from '../../reports/report-kpi-tiles/report-kpi-tiles.component';
import { RequestDatePipe } from '../../requests/request-date.pipe';
import { blockView } from '../home-block-view';
import { HomeStateComponent } from '../home-state/home-state.component';

/** La ventana de /reports por omisión: lo que cambia en el día. */
const RANGE: ReportRange = 'last24h';

/**
 * KPIs del Admin con polling cada 5 s (K8): se pausa con la pestaña oculta, se detiene al salir de /inicio y
 * espera más entre intentos ante errores. La pausa manual cumple WCAG 2.2.2, porque la información se actualiza
 * sola junto a otro contenido.
 */
@Component({
  selector: 'app-home-kpis',
  imports: [
    HomeStateComponent,
    MatButton,
    MatIcon,
    NgTemplateOutlet,
    ReportKpiTilesComponent,
    RequestDatePipe,
    RouterLink,
  ],
  templateUrl: './home-kpis.component.html',
  styleUrls: ['./home-kpis.component.scss', '../home-link.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeKpisComponent {
  private readonly reportService = inject(ReportService);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly range = RANGE;
  protected readonly source = polledResource<ReportRange, ReportKpis>({
    key: RANGE,
    load: (range) => this.reportService.getKpis(range),
  });
  protected readonly view = computed(() => blockView(this.source.state(), this.source.key()));
  protected readonly ready = computed(() => {
    const view = this.view();
    return view.status === 'ready' ? view : null;
  });
  protected readonly failure = computed(() => {
    const view = this.view();
    return view.status === 'error' ? view : null;
  });
  protected readonly paused = this.source.paused;
  protected readonly retryHint = computed(() =>
    this.paused()
      ? 'Usa Reintentar para volver a consultar.'
      : 'Se volverá a intentar automáticamente.',
  );
  protected readonly formatClock = formatClock;

  constructor() {
    this.source.setKey(RANGE);
    this.announceFailures();
  }

  protected togglePause(): void {
    const paused = !this.paused();
    this.source.setPaused(paused);
    this.announcer.announce(
      paused ? 'Actualización automática en pausa.' : 'Actualización automática reanudada.',
    );
  }

  protected retry(): void {
    this.source.refresh();
  }

  /** Los números no se anuncian en cada ciclo: se anuncia el paso entre fallo y recuperación. */
  private announceFailures(): void {
    let failed = false;
    effect(() => {
      const state = this.source.state();
      untracked(() => {
        if (state.loading || state.failed === failed) {
          return;
        }
        failed = state.failed;
        this.announcer.announce(
          failed
            ? 'No se pudieron actualizar los indicadores.'
            : 'Los indicadores se actualizaron nuevamente.',
        );
      });
    });
  }
}
