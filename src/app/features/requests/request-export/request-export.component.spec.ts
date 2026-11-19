import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, of, throwError } from 'rxjs';

import { DEFAULT_REQUEST_QUERY, RequestListQuery } from '../request-list-query';
import { RequestsService } from '../requests.service';
import { RequestExportComponent } from './request-export.component';

describe('RequestExportComponent', () => {
  const query: RequestListQuery = {
    ...DEFAULT_REQUEST_QUERY,
    status: 'EN_GESTION',
    assignee: 'me',
    page: 3,
  };

  let fixture: ComponentFixture<RequestExportComponent>;
  let element: HTMLElement;
  let exportRequests: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.spyOn>;
  let snackAction: Subject<void>;
  let downloads: string[];

  const render = async (
    response: () => Observable<Blob>,
    inputs: { total?: number; loading?: boolean } = {},
  ) => {
    exportRequests = vi.fn(response);
    await TestBed.configureTestingModule({
      imports: [RequestExportComponent],
      providers: [{ provide: RequestsService, useValue: { exportRequests } }],
    }).compileComponents();

    snackAction = new Subject<void>();
    snackOpen = vi.spyOn(TestBed.inject(MatSnackBar), 'open').mockReturnValue({
      onAction: () => snackAction,
    } as unknown as MatSnackBarRef<TextOnlySnackBar>);

    fixture = TestBed.createComponent(RequestExportComponent);
    fixture.componentRef.setInput('query', query);
    fixture.componentRef.setInput('total', inputs.total ?? 120);
    fixture.componentRef.setInput('loading', inputs.loading ?? false);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const button = () => element.querySelector<HTMLButtonElement>('button')!;
  const click = async () => {
    button().click();
    await fixture.whenStable();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T15:00:00Z'));
    downloads = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('descarga con los filtros aplicados, sin paginación, y confirma el nombre', async () => {
    await render(() => of(new Blob(['csv'], { type: 'text/csv' })));

    expect(button().textContent).toContain('Exportar CSV');
    await click();

    expect(exportRequests).toHaveBeenCalledWith({ status: 'EN_GESTION', assignee: 'me' });
    expect(downloads).toEqual(['tramites-2026-11-16.csv']);
    expect(snackOpen).toHaveBeenCalledWith('Se descargó tramites-2026-11-16.csv.', undefined, {
      duration: 4000,
      politeness: 'polite',
    });
  });

  it('mientras exporta queda ocupado, enfocable y sin doble envío', async () => {
    const response = new Subject<Blob>();
    await render(() => response);

    await click();
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().hasAttribute('disabled')).toBe(false);
    expect(button().textContent).toContain('Exportando');
    expect(element.querySelector('mat-progress-spinner')).not.toBeNull();

    await click();
    expect(exportRequests).toHaveBeenCalledTimes(1);

    response.next(new Blob(['csv']));
    response.complete();
    await fixture.whenStable();
    expect(button().getAttribute('aria-busy')).toBe('false');
    expect(element.querySelector('mat-progress-spinner')).toBeNull();
  });

  it('sobre 5.000 trámites no consulta y explica cómo acotar', async () => {
    await render(() => of(new Blob()), { total: 5001 });

    const note = element.querySelector('.request-export__note');
    expect(note?.textContent).toContain(
      'Son más de 5.000 trámites. Filtra por fecha o estado para exportar.',
    );
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().getAttribute('aria-describedby')).toBe(note?.id);

    await click();
    expect(exportRequests).not.toHaveBeenCalled();
  });

  it('con exactamente 5.000 trámites exporta', async () => {
    await render(() => of(new Blob()), { total: 5000 });

    expect(element.querySelector('.request-export__note')).toBeNull();
    expect(button().hasAttribute('aria-describedby')).toBe(false);
    await click();
    expect(exportRequests).toHaveBeenCalledTimes(1);
  });

  it('mientras el listado recarga no exporta', async () => {
    await render(() => of(new Blob()), { loading: true });

    expect(button().getAttribute('aria-disabled')).toBe('true');
    await click();
    expect(exportRequests).not.toHaveBeenCalled();
  });

  it('una falla temporal ofrece reintentar la misma exportación', async () => {
    await render(() => throwError(() => new HttpErrorResponse({ status: 503 })));

    await click();
    expect(snackOpen).toHaveBeenCalledWith(
      'No se pudo generar el archivo. Intenta nuevamente.',
      'Reintentar',
      { duration: 8000 },
    );
    expect(button().getAttribute('aria-busy')).toBe('false');

    snackAction.next();
    expect(exportRequests).toHaveBeenCalledTimes(2);
    expect(downloads).toEqual([]);
  });

  it.each([
    [
      400,
      'No se pudo exportar con estos filtros. Si son más de 5.000 trámites, filtra por fecha o estado.',
    ],
    [401, 'Tu sesión ya no permite exportar. Inicia sesión nuevamente.'],
    [403, 'Tu cuenta no tiene permiso para exportar trámites.'],
  ])('un %i avisa sin ofrecer reintentar', async (status, message) => {
    await render(() => throwError(() => new HttpErrorResponse({ status })));

    await click();
    expect(snackOpen).toHaveBeenCalledWith(message, undefined, { duration: 6000 });
  });
});
