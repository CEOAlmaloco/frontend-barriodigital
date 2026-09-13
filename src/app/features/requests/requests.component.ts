import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Request } from '../../shared/models/request.model';
import { Role } from '../../shared/models/role';
import { toDateKey } from './date-key';
import { REQUEST_STATUSES, REQUEST_STATUS_VIEW, TIPOS_TRAMITE_PROVISIONAL } from './requests.constants';
import { RequestsService } from './requests.service';

type ListState = 'loading' | 'ready' | 'error';

// Sin columna Solicitante: el backend solo expone el oid (ver deuda técnica en el README)
const COLUMNS = ['tipo', 'descripcion', 'estado', 'fecha'];

@Component({
  selector: 'app-requests',
  imports: [
    DatePipe,
    MatButton,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinner,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }],
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsComponent {
  private readonly auth = inject(AuthService);
  private readonly requestsService = inject(RequestsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly reload$ = new Subject<void>();

  protected readonly tiposTramite = TIPOS_TRAMITE_PROVISIONAL;
  protected readonly statuses = REQUEST_STATUSES;
  protected readonly statusView = REQUEST_STATUS_VIEW;
  protected readonly columns = COLUMNS;

  /** Admin y Auditor no llegan a esta vista (roleGuard), así que quien no es Funcionario es Vecino. */
  protected readonly isFuncionario = computed(() => this.auth.hasRole(Role.Funcionario));

  protected readonly listState = signal<ListState>('loading');
  /** Tal como llegan del BFF: el servidor ya filtra al Vecino por su oid y ordena por fecha descendente. */
  protected readonly requests = signal<Request[]>([]);

  protected readonly isSubmitting = signal(false);
  protected readonly submitFailed = signal(false);

  protected readonly createForm = this.formBuilder.group({
    procedureType: ['', Validators.required],
    description: ['', Validators.required],
    address: ['', Validators.required],
  });

  protected readonly filters = this.formBuilder.group({
    status: [''],
    from: this.formBuilder.control<Date | null>(null),
    to: this.formBuilder.control<Date | null>(null),
  });

  constructor() {
    this.reload$
      .pipe(
        tap(() => this.listState.set('loading')),
        // switchMap descarta respuestas viejas si los filtros cambian antes de que llegue la anterior
        switchMap(() =>
          this.requestsService.getRequests(this.currentFilters()).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((requests) => {
        if (requests) {
          this.requests.set(requests);
          this.listState.set('ready');
        } else {
          this.listState.set('error');
        }
      });

    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.loadRequests());
    this.loadRequests();
  }

  protected loadRequests(): void {
    this.reload$.next();
  }

  /** Etiqueta y tono del badge. Método tipado porque en las celdas de mat-table la fila llega como any. */
  protected statusOf(request: Request): (typeof REQUEST_STATUS_VIEW)[keyof typeof REQUEST_STATUS_VIEW] {
    return REQUEST_STATUS_VIEW[request.status];
  }

  /** Traduce el código guardado a su etiqueta. Si no está en la lista, muestra el código. */
  protected getTipoLabel(value: string): string {
    return TIPOS_TRAMITE_PROVISIONAL.find((t) => t.value === value)?.label ?? value;
  }

  protected submit(formDirective: FormGroupDirective): void {
    if (this.createForm.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitFailed.set(false);

    this.requestsService.createRequest(this.createForm.getRawValue()).subscribe({
      next: () => {
        formDirective.resetForm();
        this.isSubmitting.set(false);
        this.snackBar.open('Trámite ingresado.', undefined, { duration: 3000 });
        this.loadRequests();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.submitFailed.set(true);
      },
    });
  }

  /** Query params de GET /api/requests. El Vecino no filtra. */
  private currentFilters(): { status?: string; from?: string; to?: string } | undefined {
    if (!this.isFuncionario()) {
      return undefined;
    }

    const { status, from, to } = this.filters.getRawValue();
    return {
      ...(status ? { status } : {}),
      ...(from ? { from: toDateKey(from) } : {}),
      ...(to ? { to: toDateKey(to) } : {}),
    };
  }
}
