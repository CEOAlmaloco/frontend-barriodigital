import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import {
  ProcedureTypeDialogComponent,
  ProcedureTypeDialogData,
  ProcedureTypeDialogResult,
} from './procedure-type-dialog/procedure-type-dialog.component';

@Component({
  selector: 'app-admin',
  imports: [MatButton, MatProgressSpinner, MatTableModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listTitle = viewChild.required<ElementRef<HTMLElement>>('listTitle');
  private readonly reload$ = new Subject<void>();
  private catalogDialog: MatDialogRef<
    ProcedureTypeDialogComponent,
    ProcedureTypeDialogResult
  > | null = null;
  private readonly savedOperation = signal<'create' | 'edit' | null>(null);

  protected readonly columns = ['codigo', 'nombre', 'estado', 'cupo', 'acciones'];
  protected readonly catalog = signal<ProcedureType[]>([]);
  protected readonly hasCatalog = signal(false);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly loadError = computed(() => {
    switch (this.savedOperation()) {
      case 'create':
        return 'El tipo se creó, pero no pudimos actualizar el catálogo.';
      case 'edit':
        return 'Los cambios se guardaron, pero no pudimos actualizar el catálogo.';
      default:
        return 'No pudimos cargar los tipos de trámite. Intenta nuevamente.';
    }
  });

  constructor() {
    this.reload$
      .pipe(
        tap(() => this.loadState.set('loading')),
        // Una escritura puede reemplazar un GET en curso; su respuesta anterior se descarta.
        switchMap(() => this.catalogService.getProcedures().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((catalog) => {
        if (catalog !== null) {
          this.catalog.set(catalog);
          this.hasCatalog.set(true);
          this.loadState.set('ready');
          this.savedOperation.set(null);
        } else {
          this.loadState.set('error');
        }
      });
    this.destroyRef.onDestroy(() => this.catalogDialog?.close());
    this.reload$.next();
  }

  protected retry(): void {
    if (this.loadState() === 'error') {
      this.reload$.next();
    }
  }

  protected openCreate(event: Event): void {
    this.openDialog({ mode: 'create' }, event.currentTarget as HTMLButtonElement);
  }

  protected openEdit(procedure: ProcedureType, event: Event): void {
    this.openDialog(
      { mode: 'edit', procedure: { ...procedure } },
      event.currentTarget as HTMLButtonElement,
    );
  }

  private openDialog(data: ProcedureTypeDialogData, trigger: HTMLButtonElement): void {
    if (this.catalogDialog) {
      return;
    }
    const dialogRef = this.dialog.open<
      ProcedureTypeDialogComponent,
      ProcedureTypeDialogData,
      ProcedureTypeDialogResult
    >(ProcedureTypeDialogComponent, {
      data,
      autoFocus: 'first-heading',
      restoreFocus: false,
      panelClass: 'procedure-type-dialog',
      maxWidth: '100vw',
    });
    this.catalogDialog = dialogRef;
    const dialogComponent = dialogRef.componentInstance;
    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.catalogDialog = null;
        // Un 404 también exige recargar si se cerró con Escape o clic fuera.
        if (
          result?.kind === 'saved' ||
          result?.kind === 'reload' ||
          dialogComponent.requiresReload()
        ) {
          this.listTitle().nativeElement.focus({ preventScroll: true });
          if (result?.kind === 'saved') {
            this.savedOperation.set(result.mode);
            this.snackBar.open(
              result.mode === 'create' ? 'Tipo de trámite creado.' : 'Tipo de trámite actualizado.',
              undefined,
              { duration: 3000 },
            );
          }
          this.reload$.next();
        } else if (trigger.isConnected && trigger.getClientRects().length) {
          trigger.focus({ preventScroll: true });
        } else {
          this.listTitle().nativeElement.focus({ preventScroll: true });
        }
      });
  }
}
