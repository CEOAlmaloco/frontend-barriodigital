import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ProcedureType } from '../../../shared/models/procedure-type.model';
import { RequestStatus } from '../../../shared/models/request.model';
import { MUNICIPALITY_SINCE } from '../date-key';
import { REQUEST_SORT_OPTIONS, SEARCH_MAX_LENGTH } from '../request-list-query';
import { COMMUNE_SECTORS } from '../request-location';
import { REQUEST_STATUSES, REQUEST_STATUS_VIEW } from '../requests.constants';

export type RequestFiltersForm = FormGroup<{
  status: FormControl<RequestStatus | ''>;
  procedureType: FormControl<string>;
  sector: FormControl<string>;
  from: FormControl<Date | null>;
  to: FormControl<Date | null>;
}>;

/** Búsqueda, filtros y orden del listado. El estado vive en el contenedor y en la URL. */
@Component({
  selector: 'app-request-list-filters',
  imports: [
    MatButton,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIcon,
    MatIconButton,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }],
  templateUrl: './request-list-filters.component.html',
  styleUrl: './request-list-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.filters--staff]': 'staffLayout()' },
})
export class RequestListFiltersComponent {
  readonly form = input.required<RequestFiltersForm>();
  readonly search = input.required<FormControl<string>>();
  readonly procedureTypes = input<readonly ProcedureType[]>([]);
  readonly toMin = input<Date>(MUNICIPALITY_SINCE);
  readonly activeCount = input(0);
  readonly sortValue = input.required<string>();
  /** El listado de staff pasa a tarjetas en un ancho mayor; el orden por columnas solo existe en la tabla. */
  readonly staffLayout = input(false);

  readonly clearFilters = output<void>();
  readonly sortChange = output<string>();

  protected readonly open = signal(false);
  protected readonly statuses = REQUEST_STATUSES;
  protected readonly statusView = REQUEST_STATUS_VIEW;
  protected readonly sectors = COMMUNE_SECTORS;
  protected readonly sortOptions = REQUEST_SORT_OPTIONS;
  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly municipalitySince = MUNICIPALITY_SINCE;
  /** Incluye tipos inactivos: los trámites antiguos siguen siendo de ese tipo. */
  protected readonly typeOptions = computed(() =>
    [...this.procedureTypes()].sort((a, b) => a.label.localeCompare(b.label, 'es')),
  );

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected clearSearch(input: HTMLInputElement): void {
    this.search().setValue('');
    input.focus();
  }
}
