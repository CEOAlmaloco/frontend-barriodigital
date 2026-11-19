import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { catchError, concat, distinctUntilChanged, map, of, switchMap, timer } from 'rxjs';

import { DuplicateCandidate, DuplicateSearch } from '../../../shared/models/request.model';
import { RequestDuplicateListComponent } from '../request-duplicate-list/request-duplicate-list.component';
import { isComparableSector, isInsideCommune, roundCoordinate } from '../request-location';
import { RequestsService } from '../requests.service';

/** Espera tras el último cambio de tipo, punto o sector, para no consultar mientras se escribe o se mueve el punto. */
export const DUPLICATE_SEARCH_DELAY_MS = 500;

type WarningState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; candidates: readonly DuplicateCandidate[] }
  | { kind: 'error' };

interface SearchLocation {
  sector?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Base de la consulta, o null si todavía no hay con qué comparar: falta el tipo, o un punto o sector válido. */
export function duplicateSearch(
  procedureType: string | null | undefined,
  location: SearchLocation,
): DuplicateSearch | null {
  const type = procedureType?.trim();
  if (!type) {
    return null;
  }
  const { latitude, longitude } = location;
  const point =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isInsideCommune(latitude, longitude)
      ? { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) }
      : null;
  const sector = isComparableSector(location.sector) ? location.sector : null;
  if (!point && !sector) {
    return null;
  }
  return { procedureType: type, ...point, ...(sector ? { sector } : {}) };
}

function sameSearch(a: DuplicateSearch | null, b: DuplicateSearch | null): boolean {
  return (
    a?.procedureType === b?.procedureType &&
    a?.latitude === b?.latitude &&
    a?.longitude === b?.longitude &&
    a?.sector === b?.sector
  );
}

/**
 * Aviso no bloqueante del alta: muestra los trámites abiertos parecidos para que el Vecino decida si igual
 * ingresa el suyo. Solo lo usa el Vecino; el BFF responde 403 a cualquier otro rol.
 */
@Component({
  selector: 'app-request-duplicate-warning',
  imports: [MatButton, MatIcon, MatProgressSpinner, RequestDuplicateListComponent],
  templateUrl: './request-duplicate-warning.component.html',
  styleUrl: './request-duplicate-warning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDuplicateWarningComponent {
  readonly search = input<DuplicateSearch | null>(null);

  private readonly requests = inject(RequestsService);
  private readonly attempt = signal(0);

  protected readonly state = signal<WarningState>({ kind: 'idle' });
  protected readonly candidates = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.candidates : [];
  });
  protected readonly title = computed(() => {
    const count = this.candidates().length;
    return count === 1
      ? 'Hay 1 trámite abierto que podría estar relacionado'
      : `Hay ${count} trámites abiertos que podrían estar relacionados`;
  });
  /** Solo el resumen: leer la lista en cada cambio de ubicación sería ruido. */
  protected readonly announcement = computed(() => {
    if (this.state().kind === 'error') {
      return 'No se pudo revisar si hay trámites parecidos.';
    }
    return this.candidates().length ? `${this.title()}.` : '';
  });

  constructor() {
    const request = computed(() => ({ search: this.search(), attempt: this.attempt() }));
    toObservable(request)
      .pipe(
        distinctUntilChanged(
          (previous, next) =>
            previous.attempt === next.attempt && sameSearch(previous.search, next.search),
        ),
        // Un cambio retira lo anterior de inmediato: no quedan a la vista resultados de otra ubicación
        switchMap(({ search }) =>
          search
            ? concat(
                of<WarningState>({ kind: 'loading' }),
                timer(DUPLICATE_SEARCH_DELAY_MS).pipe(
                  switchMap(() => this.requests.findDuplicates(search)),
                  map((candidates): WarningState => ({ kind: 'ready', candidates })),
                  catchError((error: unknown) =>
                    of<WarningState>(
                      error instanceof HttpErrorResponse && error.status === 403
                        ? { kind: 'idle' }
                        : { kind: 'error' },
                    ),
                  ),
                ),
              )
            : of<WarningState>({ kind: 'idle' }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  protected retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }
}
