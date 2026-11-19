import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { DuplicateCandidate } from '../../../shared/models/request.model';
import { RequestDuplicateListComponent } from '../request-duplicate-list/request-duplicate-list.component';
import { RequestsService } from '../requests.service';

type PanelState =
  | { kind: 'unsearchable' }
  | { kind: 'loading' }
  | { kind: 'ready'; candidates: readonly DuplicateCandidate[] }
  | { kind: 'error' }
  | { kind: 'hidden' };

/**
 * Posibles duplicados de un trámite ingresado, para el Funcionario y el Admin. Con coincidencias es una tarjeta
 * del detalle; sin nada que revisar, una línea plana que distingue "no hubo" de "no se pudo comprobar".
 */
@Component({
  selector: 'app-request-duplicate-panel',
  imports: [MatButton, MatIcon, MatProgressSpinner, RequestDuplicateListComponent],
  templateUrl: './request-duplicate-panel.component.html',
  styleUrl: './request-duplicate-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.duplicate-panel--hidden]': "state().kind === 'hidden'" },
})
export class RequestDuplicatePanelComponent {
  readonly requestId = input.required<string>();
  /** Sin punto ni sector comparable, la búsqueda no tiene base y no se consulta. */
  readonly searchable = input.required<boolean>();

  private readonly requests = inject(RequestsService);
  private readonly injector = inject(Injector);
  private readonly attempt = signal(0);
  private readonly line = viewChild<ElementRef<HTMLElement>>('line');
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  /** Tras Reintentar el botón desaparece: el foco pasa a la línea y, si llegan resultados, al título. */
  private keepFocus = false;

  protected readonly state = signal<PanelState>({ kind: 'loading' });
  protected readonly candidates = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.candidates : [];
  });
  protected readonly titleId = computed(() => `duplicate-panel-title-${this.requestId()}`);
  protected readonly announcement = computed(() => {
    const kind = this.state().kind;
    if (kind === 'error') {
      return 'No se pudo buscar posibles duplicados.';
    }
    const count = this.candidates().length;
    if (!count) {
      return '';
    }
    return count === 1 ? 'Hay 1 posible duplicado.' : `Hay ${count} posibles duplicados.`;
  });

  constructor() {
    const query = computed(() => ({
      id: this.requestId(),
      searchable: this.searchable(),
      attempt: this.attempt(),
    }));
    toObservable(query)
      .pipe(
        switchMap(({ id, searchable }) =>
          searchable
            ? this.requests.findRequestDuplicates(id).pipe(
                map((candidates): PanelState => ({ kind: 'ready', candidates })),
                // 403 o 404: el rol ya no corresponde o el trámite no existe; el detalle se encarga
                catchError((error: unknown) =>
                  of<PanelState>(
                    error instanceof HttpErrorResponse && [403, 404].includes(error.status)
                      ? { kind: 'hidden' }
                      : { kind: 'error' },
                  ),
                ),
                startWith<PanelState>({ kind: 'loading' }),
              )
            : of<PanelState>({ kind: 'unsearchable' }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.state.set(state);
        if (this.keepFocus && state.kind !== 'loading') {
          this.keepFocus = false;
          this.focus(state.kind === 'ready' && state.candidates.length ? this.title : this.line);
        }
      });
  }

  protected retry(): void {
    this.keepFocus = true;
    this.line()?.nativeElement.focus();
    this.attempt.update((attempt) => attempt + 1);
  }

  private focus(target: typeof this.line): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
