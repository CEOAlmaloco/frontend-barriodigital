import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  ViewEncapsulation,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import { FailureKind, failureKind } from '../../shared/utils/http-failure';
import { businessDaysLabel } from '../requests/sla-format';
import { adminFailureCopy } from './admin-failure';
import { AdminKafkaPanelComponent } from './admin-kafka-panel/admin-kafka-panel.component';
import { AdminKpiComponent } from './admin-kpi/admin-kpi.component';
import { AdminMqPanelComponent } from './admin-mq-panel/admin-mq-panel.component';
import { AdminStateComponent } from './admin-state/admin-state.component';
import {
  ProcedureTypeDialogComponent,
  ProcedureTypeDialogData,
  ProcedureTypeDialogResult,
} from './procedure-type-dialog/procedure-type-dialog.component';

type AdminSection = 'catalog' | 'rabbitmq' | 'kafka';
type CatalogFilter = 'todos' | 'activos' | 'inactivos';

const SECTIONS: readonly { value: AdminSection; label: string; icon: string }[] = [
  { value: 'catalog', label: 'Catálogo', icon: 'category' },
  { value: 'rabbitmq', label: 'RabbitMQ', icon: 'inbox' },
  { value: 'kafka', label: 'Kafka', icon: 'hub' },
];

function toSection(value: string | null): AdminSection {
  return SECTIONS.some((section) => section.value === value) ? (value as AdminSection) : 'catalog';
}

@Component({
  selector: 'app-admin',
  imports: [
    AdminKafkaPanelComponent,
    AdminKpiComponent,
    AdminMqPanelComponent,
    AdminStateComponent,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatPrefix,
    MatProgressSpinner,
    MatSuffix,
    MatTableModule,
    MatTabsModule,
    MatTooltip,
    RouterLink,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  // Las clases admin-* son compartidas por los paneles y los diálogos de detalle: se cargan una vez.
  encapsulation: ViewEncapsulation.None,
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

  protected readonly sections = SECTIONS;
  protected readonly section = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => toSection(params.get('section')))),
    { initialValue: 'catalog' as AdminSection },
  );

  protected readonly columns = ['tipo', 'estado', 'cupo', 'disponible', 'plazo', 'acciones'];
  protected readonly catalogFilters: readonly { value: CatalogFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'activos', label: 'Activos' },
    { value: 'inactivos', label: 'Inactivos' },
  ];
  protected readonly catalog = signal<ProcedureType[]>([]);
  protected readonly hasCatalog = signal(false);
  protected readonly catalogQuery = signal('');
  protected readonly catalogFilter = signal<CatalogFilter>('todos');
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly failure = signal<FailureKind>('generic');
  protected readonly loadFailure = computed(() =>
    adminFailureCopy(this.failure(), {
      unavailable: 'El catálogo no está disponible',
      generic: 'No pudimos cargar los tipos de trámite',
    }),
  );
  protected readonly isRefreshing = signal(false);
  protected readonly catalogActive = computed(
    () => this.catalog().filter((type) => type.active).length,
  );
  protected readonly catalogWithQuota = computed(
    () => this.catalog().filter((type) => typeof type.dailyQuota === 'number').length,
  );
  protected readonly catalogExhausted = computed(
    () => this.catalog().filter((type) => this.availableQuota(type) === 'Agotado').length,
  );
  protected readonly visibleCatalog = computed(() => {
    const query = this.catalogQuery().trim().toLocaleLowerCase('es');
    const filter = this.catalogFilter();
    return this.catalog().filter((type) => {
      if ((filter === 'activos' && !type.active) || (filter === 'inactivos' && type.active)) {
        return false;
      }
      return (
        !query ||
        type.value.toLocaleLowerCase('es').includes(query) ||
        type.label.toLocaleLowerCase('es').includes(query)
      );
    });
  });
  protected readonly loadError = computed(() => {
    switch (this.savedOperation()) {
      case 'create':
        return 'El tipo se creó, pero no pudimos actualizar el catálogo.';
      case 'edit':
        return 'Los cambios se guardaron, pero no pudimos actualizar el catálogo.';
      default:
        return 'No pudimos actualizar el catálogo. Se muestran los últimos datos disponibles.';
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
        switchMap(() =>
          this.catalogService.getProcedures().pipe(
            catchError((error: unknown) => {
              this.failure.set(failureKind(error));
              return of(null);
            }),
          ),
        ),
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

  protected slaLabel({ slaBusinessDays }: ProcedureType): string {
    return slaBusinessDays == null ? 'Sin plazo' : businessDaysLabel(slaBusinessDays);
  }

  protected quotaLabel({ dailyQuota }: ProcedureType): string {
    return dailyQuota === null ? 'Sin límite' : String(dailyQuota);
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

  protected clearFilters(): void {
    this.catalogQuery.set('');
    this.catalogFilter.set('todos');
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
