import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';

import { AuditEventsComponent } from './audit-events/audit-events.component';
import { AuditView, readView } from './audit-query';
import { AuditTimelineComponent } from './audit-timeline/audit-timeline.component';

/**
 * Auditoría de solo lectura para Admin y Auditor (EP3-04, sección 8): búsqueda de eventos y timeline de un
 * trámite. Cada pestaña recuerda su última consulta mientras la pantalla siga abierta.
 */
@Component({
  selector: 'app-audit',
  imports: [AuditEventsComponent, AuditTimelineComponent, MatIcon, MatTabsModule, RouterLink],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  protected readonly view = signal<AuditView>('events');
  protected readonly links = signal<Record<AuditView, Params>>({
    events: {},
    timeline: { view: 'timeline' },
  });

  constructor() {
    let first = true;
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const view = readView((key) => params.get(key));
        const changed = view !== this.view();
        this.view.set(view);
        this.links.update((links) => ({
          ...links,
          [view]: Object.fromEntries(params.keys.map((key) => [key, params.get(key)])),
        }));
        if (changed && !first) {
          this.keepFocus();
        }
        first = false;
      });
  }

  /** Un enlace dentro de la vista anterior desaparece con ella: el foco pasa al título y no se pierde. */
  private keepFocus(): void {
    afterNextRender(
      () => {
        const active = this.document.activeElement;
        if (!active || active === this.document.body || !active.isConnected) {
          this.heading().nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
  }
}
