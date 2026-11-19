import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { saveFile } from '../../../shared/utils/download-file';
import {
  REQUEST_EXPORT_MAX_ROWS,
  RequestListQuery,
  toRequestExportParams,
} from '../request-list-query';
import { RequestsService } from '../requests.service';
import { EXPORT_MAX_ROWS_LABEL, exportFailure, exportFileName } from './request-export';

let nextId = 0;

/** Descarga en CSV el listado con los filtros aplicados. Qué filas y columnas trae lo decide requests por rol. */
@Component({
  selector: 'app-request-export',
  imports: [MatButton, MatIcon, MatProgressSpinner],
  templateUrl: './request-export.component.html',
  styleUrl: './request-export.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestExportComponent {
  private readonly requestsService = inject(RequestsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = input.required<RequestListQuery>();
  readonly total = input.required<number>();
  /** Mientras el listado recarga, el total aún no corresponde a los filtros nuevos. */
  readonly loading = input(false);

  protected readonly busy = signal(false);
  protected readonly overLimit = computed(() => this.total() > REQUEST_EXPORT_MAX_ROWS);
  protected readonly unavailable = computed(
    () => this.busy() || this.loading() || this.overLimit(),
  );
  protected readonly maxRows = EXPORT_MAX_ROWS_LABEL;
  protected readonly noteId = `request-export-note-${nextId++}`;

  protected export(): void {
    if (this.unavailable()) {
      return;
    }
    const fileName = exportFileName(new Date());
    this.busy.set(true);
    this.requestsService
      .exportRequests(toRequestExportParams(this.query()))
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (csv) => {
          saveFile(csv, fileName);
          this.snackBar.open(`Se descargó ${fileName}.`, undefined, {
            duration: 4000,
            politeness: 'polite',
          });
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    const failure = exportFailure(error);
    if (!failure.retry) {
      this.snackBar.open(failure.message, undefined, { duration: 6000 });
      return;
    }
    this.snackBar
      .open(failure.message, 'Reintentar', { duration: 8000 })
      .onAction()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.export());
  }
}
