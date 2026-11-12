import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Request, RequestStatus, RequestTransitions } from '../../../shared/models/request.model';
import { REQUESTS_ROLES, Role } from '../../../shared/models/role';
import { formatDuration } from '../duration';
import {
  AttentionAction,
  RequestAttentionPanelComponent,
} from '../request-attention-panel/request-attention-panel.component';
import {
  RequestGestionDialogComponent,
  RequestGestionDialogData,
  RequestGestionDialogResult,
} from '../request-gestion-dialog/request-gestion-dialog.component';
import { RequestDatePipe } from '../request-date.pipe';
import { RequestDetailSkeletonComponent } from '../request-detail-skeleton/request-detail-skeleton.component';
import { RequestLocationMapComponent } from '../request-location-map.component';
import { mapUrl, sectorLabel } from '../request-location';
import { RequestProgressComponent } from '../request-progress/request-progress.component';
import { RequestStatusBadgeComponent } from '../request-status-badge/request-status-badge.component';
import {
  RequestStatusDialogComponent,
  RequestStatusDialogData,
  RequestStatusDialogResult,
} from '../request-status-dialog/request-status-dialog.component';
import { RequestTimelineComponent } from '../request-timeline/request-timeline.component';
import { isClosedStatus } from '../requests.constants';
import { RequestActivity, RequestsService } from '../requests.service';

type PageState = 'loading' | 'ready' | 'error' | 'not-found';
type LoadState = 'loading' | 'ready' | 'error';
type AttachmentPreview = { url: string; extension: string };

const NOTIFIED_STATUSES: readonly RequestStatus[] = [
  'ADMITIDO',
  'EN_TERRENO',
  'RESUELTO',
  'RECHAZADO',
];

@Component({
  selector: 'app-request-detail',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatIconButton,
    RequestAttentionPanelComponent,
    RequestDetailSkeletonComponent,
    RequestLocationMapComponent,
    RequestProgressComponent,
    RequestStatusBadgeComponent,
    RequestDatePipe,
    RequestTimelineComponent,
    RouterLink,
  ],
  templateUrl: './request-detail.component.html',
  styleUrl: './request-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly requestsService = inject(RequestsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly titleService = inject(Title);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly previewTemplate =
    viewChild.required<TemplateRef<{ $implicit: AttachmentPreview }>>('attachmentPreview');

  private readonly reload$ = new Subject<void>();
  private readonly activityReload$ = new Subject<void>();
  private currentId: string | null = null;
  private openedDialog: MatDialogRef<unknown, unknown> | null = null;
  private attachmentFor: string | null = null;

  protected readonly state = signal<PageState>('loading');
  protected readonly request = signal<Request | null>(null);
  protected readonly activity = signal<RequestActivity | null>(null);
  protected readonly activityState = signal<LoadState>('loading');
  protected readonly transitions = signal<RequestTransitions | null>(null);
  protected readonly transitionsState = signal<LoadState>('loading');
  protected readonly attachmentUrl = signal<string | null>(null);
  protected readonly attachmentState = signal<LoadState>('loading');
  protected readonly taking = signal(false);
  private readonly attachmentExtension = signal('png');

  /** Un usuario tiene un solo rol (EP3-04, sección 4). Sin rol de staff se muestra lo mínimo, como al Vecino. */
  protected readonly viewer = computed<Role>(() => {
    if (this.auth.hasRole(Role.Admin)) return Role.Admin;
    if (this.auth.hasRole(Role.Funcionario)) return Role.Funcionario;
    if (this.auth.hasRole(Role.Auditor)) return Role.Auditor;
    return Role.Vecino;
  });
  protected readonly isStaff = computed(() => this.viewer() !== Role.Vecino);
  protected readonly isAuditor = computed(() => this.viewer() === Role.Auditor);
  protected readonly isClosed = computed(() => {
    const request = this.request();
    return request !== null && isClosedStatus(request.status);
  });
  protected readonly isResponsible = computed(() => {
    const assignee = this.request()?.assigneeId;
    return this.viewer() === Role.Funcionario && !!assignee && assignee === this.auth.userId();
  });
  protected readonly canOperate = computed(
    () => !this.isClosed() && (this.viewer() === Role.Admin || this.isResponsible()),
  );
  protected readonly allowedStatuses = computed(() => {
    const request = this.request();
    return request ? (this.transitions()?.[request.status] ?? []) : [];
  });
  protected readonly backLink = computed(() =>
    REQUESTS_ROLES.includes(this.viewer())
      ? { path: '/tramites', label: 'Trámites' }
      : { path: '/inicio', label: 'Inicio' },
  );
  protected readonly typeLabel = computed(() => {
    const request = this.request();
    return request ? request.procedureLabel?.trim() || request.procedureType : '';
  });
  protected readonly folio = computed(() => this.request()?.folio?.trim() || null);
  protected readonly stages = computed(() => this.activity()?.tiempos.etapas ?? []);
  protected readonly sector = computed(() => sectorLabel(this.request()?.sector));
  protected readonly hasPoint = computed(() => {
    const request = this.request();
    return request?.latitude != null && request.longitude != null;
  });
  protected readonly mapLink = computed(() => {
    const request = this.request();
    return request ? mapUrl(request) : null;
  });
  protected readonly deadline = computed(() => {
    const days = this.request()?.slaBusinessDays;
    if (days == null || days <= 0) {
      return null;
    }
    return days === 1 ? '1 día hábil' : `${days} días hábiles`;
  });
  protected readonly times = computed(() => {
    const activity = this.activity();
    if (!activity || !this.isStaff()) {
      return [];
    }
    const { tiempos, contacto } = activity;
    const items: { label: string; value: string }[] = [];
    const add = (label: string, seconds: number | null | undefined) => {
      if (seconds != null) items.push({ label, value: formatDuration(seconds) });
    };
    add('Desde el ingreso', tiempos.desdeElIngresoSegundos);
    add('Hasta el cierre', tiempos.totalResolucionSegundos);
    add('Primera atención', tiempos.primeraAtencionSegundos);
    add('Primera asignación', tiempos.primeraAsignacionSegundos);
    if (contacto && contacto.intentos > 0) {
      items.push({ label: 'Intentos de contacto', value: String(contacto.intentos) });
    }
    return items;
  });
  protected readonly nextContact = computed(() => {
    const contacto = this.activity()?.contacto;
    return this.isStaff() && contacto?.siguienteAccion ? contacto : null;
  });

  constructor() {
    this.activityReload$
      .pipe(
        switchMap(() => {
          this.activityState.set(this.activity() ? 'ready' : 'loading');
          return this.requestsService
            .getActividad(this.currentId ?? '')
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((activity) => {
        if (activity) {
          this.activity.set(activity);
          this.activityState.set('ready');
        } else if (!this.activity()) {
          this.activityState.set('error');
        }
      });

    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
      this.reload$.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([id]) => {
          const sameRequest = id === this.currentId && this.state() === 'ready';
          if (!sameRequest) {
            this.resetFor(id);
          }
          return this.requestsService.getRequest(id).pipe(
            map((request) => ({ request, error: null as unknown, sameRequest })),
            catchError((error: unknown) => of({ request: null, error, sameRequest })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ request, error, sameRequest }) => {
        if (request) {
          this.show(request, !sameRequest);
          return;
        }
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.request.set(null);
          this.state.set('not-found');
          this.titleService.setTitle('Trámite no encontrado | BarrioDigital');
        } else if (sameRequest) {
          this.snackBar.open('No se pudo actualizar el trámite. Inténtalo de nuevo.', undefined, {
            duration: 4000,
          });
        } else {
          this.state.set('error');
        }
      });

    this.destroyRef.onDestroy(() => {
      this.openedDialog?.close();
      this.revokeAttachment();
    });
  }

  protected retry(): void {
    this.state.set('loading');
    this.reload$.next();
  }

  protected loadActivity(): void {
    this.activityReload$.next();
  }

  protected loadTransitions(): void {
    this.transitionsState.set('loading');
    this.requestsService
      .getTransitions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (transitions) => {
          this.transitions.set(transitions);
          this.transitionsState.set('ready');
        },
        error: () => this.transitionsState.set('error'),
      });
  }

  protected loadAttachment(): void {
    const id = this.currentId;
    if (!id) {
      return;
    }
    this.attachmentState.set('loading');
    this.requestsService
      .getAttachment(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (image) => {
          if (id !== this.currentId) {
            return;
          }
          if (image.type !== 'image/jpeg' && image.type !== 'image/png') {
            this.attachmentState.set('error');
            return;
          }
          this.revokeAttachment();
          this.attachmentFor = id;
          this.attachmentExtension.set(image.type === 'image/jpeg' ? 'jpg' : 'png');
          this.attachmentUrl.set(URL.createObjectURL(image));
          this.attachmentState.set('ready');
        },
        error: () => {
          if (id === this.currentId) {
            this.attachmentState.set('error');
          }
        },
      });
  }

  protected copyFolio(): void {
    const folio = this.folio();
    if (!folio) {
      return;
    }
    const copied = this.clipboard.copy(folio);
    this.snackBar.open(copied ? 'Folio copiado.' : 'No se pudo copiar el folio.', undefined, {
      duration: 2500,
    });
  }

  protected take(): void {
    const request = this.request();
    if (!request || this.taking() || this.openedDialog) {
      return;
    }
    this.taking.set(true);
    this.requestsService
      .take(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (taken) => {
          this.taking.set(false);
          this.request.set(taken);
          this.afterChange('Tomaste el trámite. Ahora eres responsable.');
        },
        error: (error: unknown) => {
          this.taking.set(false);
          const { message, refresh } = takeFailure(error);
          this.snackBar.open(message, undefined, { duration: 5000 });
          if (refresh) {
            this.reload$.next();
            this.loadActivity();
          }
        },
      });
  }

  protected openStatusDialog(action: AttentionAction): void {
    const request = this.request();
    if (
      !request ||
      this.openedDialog ||
      !this.canOperate() ||
      !this.allowedStatuses().includes(action.status)
    ) {
      return;
    }
    const ref = this.dialog.open<
      RequestStatusDialogComponent,
      RequestStatusDialogData,
      RequestStatusDialogResult
    >(RequestStatusDialogComponent, {
      data: {
        request,
        status: action.status,
        procedureTypeLabel: this.typeLabel(),
        requireInterventionReason: this.viewer() === Role.Admin,
        context: 'detail',
      },
      autoFocus: 'first-heading',
      panelClass: 'request-dialog',
      restoreFocus: false,
      ariaDescribedBy: 'request-status-description',
    });
    this.openedDialog = ref;
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.openedDialog = null;
        if (result?.kind === 'saved') {
          this.request.set(result.request);
          this.afterChange(
            NOTIFIED_STATUSES.includes(result.request.status)
              ? 'Estado actualizado. El aviso al vecino se procesa en segundo plano.'
              : 'Estado actualizado.',
          );
        } else if (result?.kind === 'reload') {
          this.reload$.next();
          this.loadActivity();
          this.focusHeading();
        } else {
          this.restoreFocus(action.trigger);
        }
      });
  }

  protected openGestionDialog(trigger: HTMLButtonElement): void {
    const request = this.request();
    if (!request || this.openedDialog || !this.canOperate()) {
      return;
    }
    const ref = this.dialog.open<
      RequestGestionDialogComponent,
      RequestGestionDialogData,
      RequestGestionDialogResult
    >(RequestGestionDialogComponent, {
      data: { requestId: request.id, requireInterventionReason: this.viewer() === Role.Admin },
      autoFocus: 'first-heading',
      panelClass: 'request-dialog',
      restoreFocus: false,
      width: '36rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.openedDialog = ref;
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.openedDialog = null;
        if (result?.kind === 'saved') {
          this.activity.set(result.activity);
          this.activityState.set('ready');
          this.snackBar.open('Gestión registrada.', undefined, { duration: 3000 });
          this.restoreFocus(trigger);
          return;
        }
        if (result?.kind === 'reload') {
          this.reload$.next();
        }
        this.loadActivity();
        this.restoreFocus(trigger);
      });
  }

  protected openPreview(): void {
    const url = this.attachmentUrl();
    if (!url || this.openedDialog) {
      return;
    }
    const ref = this.dialog.open(this.previewTemplate(), {
      data: { url, extension: this.attachmentExtension() } satisfies AttachmentPreview,
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      width: '56rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.openedDialog = ref;
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.openedDialog = null;
      });
  }

  private resetFor(id: string): void {
    this.currentId = id;
    this.state.set('loading');
    this.request.set(null);
    this.activity.set(null);
    this.activityState.set('loading');
    this.revokeAttachment();
    this.attachmentState.set('loading');
  }

  private show(request: Request, firstLoad: boolean): void {
    this.request.set(request);
    this.state.set('ready');
    this.titleService.setTitle(`${this.folio() ?? 'Detalle del trámite'} | BarrioDigital`);
    if (firstLoad) {
      this.loadActivity();
      this.focusHeading();
    }
    if (request.hasAttachment && this.attachmentFor !== request.id) {
      this.loadAttachment();
    }
    if (this.canOperate() && this.transitionsState() !== 'ready') {
      this.loadTransitions();
    }
  }

  /** Tras una acción la respuesta ya trae el trámite; el historial y los tiempos se vuelven a pedir. */
  private afterChange(message: string): void {
    this.snackBar.open(message, undefined, { duration: 3500 });
    this.titleService.setTitle(`${this.folio() ?? 'Detalle del trámite'} | BarrioDigital`);
    this.loadActivity();
    if (this.canOperate() && this.transitionsState() !== 'ready') {
      this.loadTransitions();
    }
    this.focusHeading();
  }

  private restoreFocus(trigger: HTMLButtonElement): void {
    if (trigger.isConnected && trigger.getClientRects().length) {
      trigger.focus({ preventScroll: true });
    } else {
      this.focusHeading();
    }
  }

  private focusHeading(): void {
    afterNextRender(() => this.heading()?.nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  private revokeAttachment(): void {
    const url = this.attachmentUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.attachmentUrl.set(null);
    this.attachmentFor = null;
  }
}

function takeFailure(error: unknown): { message: string; refresh: boolean } {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'No se pudo tomar el trámite. Inténtalo de nuevo.', refresh: false };
  }
  const message = typeof error.error?.message === 'string' ? error.error.message : '';
  switch (error.status) {
    case 0:
      return {
        message: 'No se pudo tomar el trámite. Revisa tu conexión e inténtalo de nuevo.',
        refresh: false,
      };
    case 403:
      return { message: 'No tienes permiso para tomar este trámite.', refresh: true };
    case 404:
      return { message: 'El trámite ya no está disponible.', refresh: true };
    case 409:
      return {
        message:
          message === 'No se puede asignar un tramite cerrado'
            ? 'El trámite ya está cerrado.'
            : 'Otra persona tomó este trámite. Actualizamos la información.',
        refresh: true,
      };
    default:
      return { message: 'No se pudo tomar el trámite. Inténtalo de nuevo.', refresh: false };
  }
}
