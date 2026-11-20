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
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltip } from '@angular/material/tooltip';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import { businessDaysLabel } from '../requests/sla-format';
import { AdminKafkaPanelComponent } from './admin-kafka-panel/admin-kafka-panel.component';
import { AdminMqPanelComponent } from './admin-mq-panel/admin-mq-panel.component';
import {
  AdminNavSection,
  AdminOverviewComponent,
} from './admin-overview/admin-overview.component';
import {
  ProcedureTypeDialogComponent,
  ProcedureTypeDialogData,
  ProcedureTypeDialogResult,
} from './procedure-type-dialog/procedure-type-dialog.component';

type AdminSection = 'panel' | AdminNavSection;

@Component({
  selector: 'app-admin',
  imports: [
    AdminKafkaPanelComponent,
    AdminMqPanelComponent,
    AdminOverviewComponent,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTableModule,
    MatTabsModule,
    MatTooltip,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listTitle = viewChild<ElementRef<HTMLElement>>('listTitle');
  private readonly reload$ = new Subject<void | 'manual'>();
  private catalogDialog: MatDialogRef<
    ProcedureTypeDialogComponent,
    ProcedureTypeDialogResult
  > | null = null;
  private readonly savedOperation = signal<'create' | 'edit' | null>(null);

  protected readonly section = signal<AdminSection>('panel');

  protected readonly columns = [
    'codigo',
    'nombre',
    'estado',
    'cupo',
    'disponible',
    'plazo',
    'acciones',
  ];
  protected readonly catalog = signal<ProcedureType[]>([]);
  protected readonly hasCatalog = signal(false);
  protected readonly catalogQuery = signal('');
  protected readonly catalogStatus = signal<'all' | 'active' | 'inactive'>('all');
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly isRefreshing = signal(false);
  protected readonly catalogActive = computed(
    () => this.catalog().filter((type) => type.active).length,
  );
  protected readonly visibleCatalog = computed(() => {
    const q = this.catalogQuery().trim().toLowerCase();
    const status = this.catalogStatus();
    return this.catalog().filter((type) => {
      if (status === 'active' && !type.active) {
        return false;
      }
      if (status === 'inactive' && type.active) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        type.value.toLowerCase().includes(q) ||
        type.label.toLowerCase().includes(q)
      );
    });
  });
  protected readonly catalogWithQuota = computed(
    () => this.catalog().filter((type) => typeof type.dailyQuota === 'number').length,
  );
  protected readonly catalogExhausted = computed(
    () =>
      this.catalog().filter((type) => {
        const available = this.availableQuota(type);
        return available === 'Agotado' || available === 0;
      }).length,
  );
  protected readonly loadError = computed(() => {
    switch (this.savedOperation()) {
      case 'create':
        return 'El tipo se creó, pero no pudimos actualizar el catálogo.';
      case 'edit':
        return 'Los cambios se guardaron, pero no pudimos actualizar el catálogo.';
      default:
        return this.hasCatalog()
          ? 'No pudimos actualizar el catálogo. Se muestran los últimos datos disponibles. Intenta nuevamente.'
          : 'No pudimos cargar los tipos de trámite. Intenta nuevamente.';
    }
  });

  constructor() {
    this.reload$
      .pipe(
        tap((source) => {
          this.loadState.set('loading');
          this.isRefreshing.set(source === 'manual');
        }),
        // Una escritura puede reemplazar un GET en curso; su respuesta anterior se descarta.
        switchMap(() => this.catalogService.getProcedures().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((catalog) => {
        this.isRefreshing.set(false);
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

  protected selectSection(section: AdminSection): void {
    this.section.set(section);
  }

  protected slaLabel({ slaBusinessDays }: ProcedureType): string {
    return slaBusinessDays == null ? 'Sin plazo' : businessDaysLabel(slaBusinessDays);
  }

  protected availableQuota({ dailyQuota, remainingQuota }: ProcedureType): number | string {
    if (dailyQuota === null && remainingQuota === null) return 'Sin límite';
    if (
      typeof dailyQuota !== 'number' ||
      !Number.isInteger(dailyQuota) ||
      dailyQuota < 1 ||
      typeof remainingQuota !== 'number' ||
      !Number.isInteger(remainingQuota) ||
      remainingQuota < 0 ||
      remainingQuota > dailyQuota
    ) {
      return 'No disponible';
    }
    return remainingQuota === 0 ? 'Agotado' : remainingQuota;
  }

  protected refresh(): void {
    if (this.loadState() === 'ready') {
      this.reload$.next('manual');
    }
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
          this.listTitle()?.nativeElement.focus({ preventScroll: true });
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
          this.listTitle()?.nativeElement.focus({ preventScroll: true });
        }
      });
  }
}
