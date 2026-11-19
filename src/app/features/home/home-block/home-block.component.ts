import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { formatClock, formatCount } from '../../reports/report-format';
import { ReportSkeletonComponent } from '../../reports/report-skeleton/report-skeleton.component';
import { RequestDatePipe } from '../../requests/request-date.pipe';
import { BlockView } from '../home-block-view';
import { HomeStateComponent } from '../home-state/home-state.component';

/**
 * Bloque de /inicio: carga, falla y se actualiza por separado (EP3-04, sección 7). El contenido se proyecta
 * con los datos listos; `[homeBlockEmpty]` es el estado vacío y `[homeBlockFooter]`, el pie con el enlace a la
 * vista completa o la paginación.
 */
@Component({
  selector: 'app-home-block',
  imports: [
    HomeStateComponent,
    MatButton,
    MatIcon,
    MatIconButton,
    MatTooltip,
    NgTemplateOutlet,
    ReportSkeletonComponent,
    RequestDatePipe,
  ],
  templateUrl: './home-block.component.html',
  styleUrl: './home-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeBlockComponent {
  private readonly announcer = inject(LiveAnnouncer);

  readonly headingId = input.required<string>();
  readonly heading = input.required<string>();
  readonly view = input.required<BlockView<unknown>>();
  /** Total de la fuente; no se muestra hasta que hay datos. */
  readonly count = input<number | null>(null);
  readonly alertCount = input(false);
  readonly description = input('');
  /** `lastEventAt` de report. Las demás fuentes no lo tienen y muestran solo la hora de la consulta. */
  readonly dataAt = input<string | null>(null);
  readonly empty = input(false);
  /** Sin pie cuando no hay nada que poner en él, como una sola página de resultados. */
  readonly footer = input(true);
  /** Servicio en el texto de "No disponible": «El servicio de reportes no responde». */
  readonly service = input.required<string>();

  readonly refresh = output<void>();

  private readonly pending = signal(false);

  protected readonly ready = computed(() => {
    const view = this.view();
    return view.status === 'ready' ? view : null;
  });
  protected readonly failure = computed(() => {
    const view = this.view();
    return view.status === 'error' ? view : null;
  });
  protected readonly busy = computed(() => {
    const view = this.view();
    return (
      view.status === 'loading' ||
      (view.status === 'ready' && view.loading) ||
      (view.status === 'error' && view.retrying)
    );
  });
  protected readonly countLabel = computed(() => {
    const count = this.count();
    return count === null ? null : formatCount(count);
  });
  protected readonly formatClock = formatClock;

  constructor() {
    // Se anuncia el resultado de la acción de la persona, no cada carga
    effect(() => {
      const view = this.view();
      const busy = this.busy();
      untracked(() => {
        if (!this.pending() || busy) {
          return;
        }
        this.pending.set(false);
        const ok = view.status === 'ready' && !view.stale;
        this.announcer.announce(
          ok ? `${this.heading()}: actualizado.` : `No se pudo actualizar ${this.heading()}.`,
        );
      });
    });
  }

  protected requestRefresh(): void {
    if (this.busy()) {
      return;
    }
    this.pending.set(true);
    this.refresh.emit();
  }
}
