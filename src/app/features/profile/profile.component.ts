import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { AccessibilityService } from '../../core/accessibility/accessibility.service';
import type { ContrastMode } from '../../core/accessibility/accessibility.model';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import {
  OVERSIGHT_ROLES,
  REPORTS_ROLES,
  ROLE_LABELS,
  Role,
} from '../../shared/models/role';
import type { Request } from '../../shared/models/request.model';
import { personInitials } from '../../shared/utils/person-initials';
import { failureKind } from '../../shared/utils/http-failure';
import { REQUEST_STATUS_VIEW } from '../requests/requests.constants';
import { RequestsService } from '../requests/requests.service';

type PrefsError = 'unavailable' | 'forbidden' | 'unauthorized' | 'generic';

type ProfileSection =
  | 'cuenta'
  | 'notificaciones'
  | 'accesibilidad'
  | 'actividad'
  | 'privacidad'
  | 'trabajo'
  | 'sesion';

interface NavItem {
  id: ProfileSection;
  label: string;
  hint: string;
  icon: string;
  roles?: readonly Role[];
}

interface Shortcut {
  label: string;
  description: string;
  path: string;
  icon: string;
  roles: readonly Role[];
}

interface WorkPreferences {
  preferAssignedOnly: boolean;
  openTramitesOnStart: boolean;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  at: string;
  path: string;
}

const TEXT_LABELS = ['87%', '100%', '112%', '125%', '137%', '150%'] as const;
const PHOTO_KEY_PREFIX = 'bd.profile.photo.';
const WORK_KEY_PREFIX = 'bd.profile.work.';
const PHOTO_MAX_BYTES = 512 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Personal en equipos compartidos: no persiste foto/prefs de trabajo al cerrar el navegador. */
function profileStore(role: Role | null): Storage {
  if (role === Role.Admin || role === Role.Funcionario || role === Role.Auditor) {
    return sessionStorage;
  }
  return localStorage;
}

const NAV: readonly NavItem[] = [
  {
    id: 'cuenta',
    label: 'Información de cuenta',
    hint: 'Datos personales y rol',
    icon: 'person_outline',
  },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    hint: 'Avisos por correo',
    icon: 'notifications_none',
  },
  {
    id: 'accesibilidad',
    label: 'Accesibilidad',
    hint: 'Contraste, texto y navegación',
    icon: 'accessibility_new',
  },
  {
    id: 'actividad',
    label: 'Mi actividad',
    hint: 'Trámites recientes',
    icon: 'history',
  },
  {
    id: 'privacidad',
    label: 'Privacidad y seguridad',
    hint: 'Datos personales y autenticación',
    icon: 'verified_user',
  },
  {
    id: 'trabajo',
    label: 'Preferencias de trabajo',
    hint: 'Bandeja y acceso rápido',
    icon: 'work_outline',
    roles: [Role.Funcionario, Role.Admin],
  },
  { id: 'sesion', label: 'Sesión', hint: 'Microsoft Entra ID', icon: 'logout' },
];

const SHORTCUTS: readonly Shortcut[] = [
  {
    label: 'Mis trámites',
    description: 'Consultar y seguir tus solicitudes',
    path: '/tramites',
    icon: 'assignment',
    roles: [Role.Vecino],
  },
  {
    label: 'Trámites',
    description: 'Bandeja operativa de la comuna',
    path: '/tramites',
    icon: 'assignment',
    roles: [Role.Funcionario, Role.Admin, Role.Auditor],
  },
  {
    label: 'Administración',
    description: 'Tipos de trámite y cupos',
    path: '/administracion',
    icon: 'settings',
    roles: [Role.Admin],
  },
  {
    label: 'Reportes',
    description: 'Indicadores y plazos',
    path: '/reportes',
    icon: 'insights',
    roles: OVERSIGHT_ROLES,
  },
  {
    label: 'Mapa de trámites',
    description: 'Ubicación de casos abiertos',
    path: '/reportes/mapa',
    icon: 'map',
    roles: REPORTS_ROLES,
  },
  {
    label: 'Auditoría',
    description: 'Historial interno de eventos',
    path: '/auditoria',
    icon: 'history',
    roles: OVERSIGHT_ROLES,
  },
];

const CITIZEN_EMAIL_CHANNELS = [
  {
    title: 'Comprobantes PDF',
    detail: 'Se envían cuando el trámite lo requiere. No dependen de esta preferencia.',
  },
  {
    title: 'Tickets de cuadrilla',
    detail: 'Comunicación operativa del municipio. Se mantiene activa.',
  },
] as const;

const STAFF_EMAIL_CHANNELS = [
  {
    title: 'Comprobantes y tickets operativos',
    detail: 'Siguen el flujo municipal. No se apagan con esta preferencia.',
  },
] as const;

/**
 * Perfil de cuenta municipal (EP3-72): identidad Entra, avisos del BFF, accesibilidad local
 * y secciones de privacidad/actividad sin convertir la pantalla en otra bandeja de trámites.
 */
@Component({
  selector: 'app-profile',
  imports: [
    DatePipe,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatSlideToggle,
    RouterLink,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly accessibility = inject(AccessibilityService);
  private readonly requests = inject(RequestsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly Role = Role;
  protected readonly preferences = this.accessibility.preferences;
  protected readonly section = signal<ProfileSection>('cuenta');
  /** En pantallas angostas: lista de secciones vs. detalle abierto. */
  protected readonly mobileHub = signal(true);

  protected readonly accountName = computed(() => {
    const account = this.auth.account();
    return account?.name ?? account?.username ?? 'Cuenta municipal';
  });
  protected readonly accountEmail = computed(() => this.auth.account()?.username ?? '');
  protected readonly userId = computed(() => this.auth.userId() ?? '');
  protected readonly role = this.auth.role;
  protected readonly roleLabel = computed(() => {
    const role = this.role();
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly initials = computed(() => personInitials(this.accountName()));
  protected readonly lastSignIn = computed(() => {
    const claims = this.auth.account()?.idTokenClaims as Record<string, unknown> | undefined;
    const authTime = claims?.['auth_time'];
    if (typeof authTime === 'number' && Number.isFinite(authTime)) {
      return new Date(authTime * 1000);
    }
    const iat = claims?.['iat'];
    if (typeof iat === 'number' && Number.isFinite(iat)) {
      return new Date(iat * 1000);
    }
    return null;
  });
  protected readonly navItems = computed(() => {
    const role = this.role();
    return NAV.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));
  });
  protected readonly shortcuts = computed(() => {
    const role = this.role();
    return role ? SHORTCUTS.filter((item) => item.roles.includes(role)) : [];
  });
  protected readonly isVecino = computed(() => this.role() === Role.Vecino);
  protected readonly showWorkPrefs = computed(() => {
    const role = this.role();
    return role === Role.Funcionario || role === Role.Admin;
  });
  protected readonly emailChannels = computed(() =>
    this.isVecino() ? CITIZEN_EMAIL_CHANNELS : STAFF_EMAIL_CHANNELS,
  );
  protected readonly notificationsLead = computed(() =>
    this.isVecino()
      ? 'Elige qué avisos recibir por correo sobre tus trámites.'
      : 'Preferencia de correo de tu cuenta municipal. Aplica a los avisos asociados a tu identidad.',
  );
  protected readonly notificationsHint = computed(() =>
    this.isVecino()
      ? 'Cambios de estado, comentarios y resoluciones de tus solicitudes.'
      : 'Avisos dirigidos a tu usuario. Los comprobantes y tickets operativos siguen activos.',
  );
  protected readonly activityLead = computed(() => {
    switch (this.role()) {
      case Role.Funcionario:
        return 'Trámites recientes de tu bandeja (asignados a ti cuando aplica).';
      case Role.Admin:
        return 'Trámites recientes de la comuna.';
      case Role.Auditor:
        return 'Trámites recientes visibles para consulta.';
      default:
        return 'Trámites recientes asociados a tu cuenta.';
    }
  });
  protected readonly activityCta = computed(() =>
    this.isVecino() ? 'Ver mis trámites' : 'Ir a Trámites',
  );
  protected readonly privacyBullets = computed(() => {
    if (this.isVecino()) {
      return [
        'Usamos los datos de tu cuenta y la información del trámite (tipo, descripción, ubicación e imagen adjunta, si corresponde).',
        'El personal municipal atiende el caso; otros vecinos no ven tus solicitudes.',
        'Contraseña y verificación en dos pasos se administran en Microsoft Entra ID, no en esta aplicación.',
      ] as const;
    }
    if (this.role() === Role.Auditor) {
      return [
        'Tu cuenta permite consultar trámites, reportes y auditoría según el rol Auditor.',
        'Los datos operativos se usan para control y seguimiento; no atiendes ni modificas trámites desde este perfil.',
        'Contraseña y verificación en dos pasos se administran en Microsoft Entra ID, no en esta aplicación.',
      ] as const;
    }
    return [
      'Tu cuenta permite operar o administrar trámites según el rol asignado en Entra ID.',
      'Los motivos de intervención y datos internos quedan en el historial para el personal autorizado.',
      'Contraseña y verificación en dos pasos se administran en Microsoft Entra ID, no en esta aplicación.',
    ] as const;
  });
  protected readonly correctionHref = computed(() => {
    const subject = encodeURIComponent('Solicitud de corrección de datos personales — BarrioDigital');
    const email = this.accountEmail();
    const body = encodeURIComponent(
      `Solicito corregir mis datos personales en BarrioDigital.\nCuenta: ${email || 'sin correo'}\nIdentificador: ${this.userId() || 'sin oid'}\nDetalle de la corrección:\n`,
    );
    return `mailto:${environment.supportEmail}?subject=${subject}&body=${body}`;
  });
  protected readonly supportHref = computed(() => {
    const subject = encodeURIComponent('Consulta sobre mi cuenta en BarrioDigital');
    const email = this.accountEmail();
    const body = email ? `&body=${encodeURIComponent(`Cuenta: ${email}`)}` : '';
    return `mailto:${environment.supportEmail}?subject=${subject}${body}`;
  });

  protected readonly photoUrl = signal<string | null>(null);
  protected readonly emailEnabled = signal(true);
  protected readonly prefsLoading = signal(true);
  protected readonly prefsSaving = signal(false);
  protected readonly prefsError = signal<PrefsError | null>(null);
  protected readonly activity = signal<ActivityItem[]>([]);
  protected readonly activityLoading = signal(false);
  protected readonly activityError = signal(false);
  protected readonly workPrefs = signal<WorkPreferences>({
    preferAssignedOnly: false,
    openTramitesOnStart: true,
  });

  constructor() {
    this.loadPhoto();
    this.loadWorkPreferences();
    this.loadNotificationPreferences();
    this.loadRecentActivity();
  }

  protected selectSection(id: ProfileSection): void {
    this.section.set(id);
    this.mobileHub.set(false);
  }

  protected backToHub(): void {
    this.mobileHub.set(true);
  }

  protected textLabel(): string {
    return TEXT_LABELS[this.preferences().textStep + 1] ?? '100%';
  }

  protected isContrast(mode: ContrastMode): boolean {
    return !this.preferences().contrastFollowSystem && this.preferences().contrast === mode;
  }

  protected isContrastFollowSystem(): boolean {
    return this.preferences().contrastFollowSystem;
  }

  protected isMotionFollowSystem(): boolean {
    return this.preferences().motionFollowSystem;
  }

  protected increaseText(): void {
    this.accessibility.increaseText();
  }

  protected decreaseText(): void {
    this.accessibility.decreaseText();
  }

  protected setContrast(mode: ContrastMode): void {
    this.accessibility.setContrast(mode);
  }

  protected followSystemContrast(): void {
    this.accessibility.followSystemContrast();
  }

  protected toggleGrayscale(): void {
    this.accessibility.toggleGrayscale();
  }

  protected toggleReadableFont(): void {
    this.accessibility.toggleReadableFont();
  }

  protected toggleUnderlineLinks(): void {
    this.accessibility.toggleUnderlineLinks();
  }

  protected setMotionPaused(paused: boolean): void {
    this.accessibility.setMotionPaused(paused);
  }

  protected followSystemMotion(): void {
    this.accessibility.followSystemMotion();
  }

  protected resetAccessibility(): void {
    this.accessibility.reset();
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!PHOTO_TYPES.has(file.type) || file.size > PHOTO_MAX_BYTES) {
      this.snackBar.open('No se pudo actualizar la imagen.', 'Cerrar', { duration: 4000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) {
        return;
      }
      const key = this.photoKey();
      if (key) {
        profileStore(this.role()).setItem(key, dataUrl);
      }
      this.photoUrl.set(dataUrl);
      this.snackBar.open('Imagen actualizada.', 'Cerrar', { duration: 3000 });
    };
    reader.readAsDataURL(file);
  }

  protected clearPhoto(): void {
    const key = this.photoKey();
    if (key) {
      profileStore(this.role()).removeItem(key);
    }
    this.photoUrl.set(null);
  }

  protected onEmailToggle(event: MatSlideToggleChange): void {
    const next = event.checked;
    const previous = this.emailEnabled();
    if (next === previous || this.prefsSaving()) {
      event.source.checked = previous;
      return;
    }
    this.prefsSaving.set(true);
    this.prefsError.set(null);
    this.requests
      .updateNotificationPreferences(next)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prefs) => {
          this.emailEnabled.set(prefs.emailEnabled);
          this.prefsSaving.set(false);
          this.snackBar.open(
            prefs.emailEnabled ? 'Avisos por correo activados.' : 'Avisos por correo pausados.',
            'Cerrar',
            { duration: 4000 },
          );
        },
        error: (error: unknown) => {
          this.prefsSaving.set(false);
          event.source.checked = previous;
          this.prefsError.set(prefsFailure(error));
          this.snackBar.open('No se pudo guardar la preferencia de avisos.', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  protected retryPreferences(): void {
    this.loadNotificationPreferences();
  }

  protected retryActivity(): void {
    this.loadRecentActivity();
  }

  protected onWorkToggle(key: keyof WorkPreferences, event: MatSlideToggleChange): void {
    const next = { ...this.workPrefs(), [key]: event.checked };
    this.workPrefs.set(next);
    const storageKey = this.workKey();
    if (storageKey) {
      profileStore(this.role()).setItem(storageKey, JSON.stringify(next));
    }
  }

  protected signOut(): void {
    this.auth.logout();
  }

  protected statusLabel(status: string): string {
    return REQUEST_STATUS_VIEW[status as keyof typeof REQUEST_STATUS_VIEW]?.label ?? status;
  }

  private photoKey(): string | null {
    const id = this.userId();
    return id ? `${PHOTO_KEY_PREFIX}${id}` : null;
  }

  private workKey(): string | null {
    const id = this.userId();
    return id ? `${WORK_KEY_PREFIX}${id}` : null;
  }

  private loadPhoto(): void {
    const key = this.photoKey();
    if (!key) {
      return;
    }
    const stored = profileStore(this.role()).getItem(key);
    if (stored?.startsWith('data:image/')) {
      this.photoUrl.set(stored);
    }
  }

  private loadWorkPreferences(): void {
    const key = this.workKey();
    if (!key) {
      return;
    }
    try {
      const raw = profileStore(this.role()).getItem(key);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<WorkPreferences>;
      this.workPrefs.set({
        preferAssignedOnly: parsed.preferAssignedOnly === true,
        openTramitesOnStart: parsed.openTramitesOnStart !== false,
      });
    } catch {
      // Preferencia local ilegible: se usan los valores por defecto.
    }
  }

  private loadNotificationPreferences(): void {
    this.prefsLoading.set(true);
    this.prefsError.set(null);
    this.requests
      .getNotificationPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prefs) => {
          this.emailEnabled.set(prefs.emailEnabled);
          this.prefsLoading.set(false);
        },
        error: (error: unknown) => {
          this.prefsLoading.set(false);
          this.prefsError.set(prefsFailure(error));
        },
      });
  }

  private loadRecentActivity(): void {
    this.activityLoading.set(true);
    this.activityError.set(false);
    const params: Record<string, string> = { page: '0', size: '5', sort: 'createdAt,desc' };
    if (this.role() === Role.Funcionario) {
      params['assignee'] = 'me';
    }
    this.requests
      .getRequests(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.activity.set(page.content.map((request) => this.toActivity(request)));
          this.activityLoading.set(false);
        },
        error: () => {
          this.activityLoading.set(false);
          this.activityError.set(true);
        },
      });
  }

  private toActivity(request: Request): ActivityItem {
    const label = request.procedureLabel ?? request.procedureType;
    const folio = request.folio ? ` · ${request.folio}` : '';
    return {
      id: request.id,
      title: `${label}${folio}`,
      detail: `Estado actual: ${this.statusLabel(request.status)}`,
      at: request.createdAt,
      path: `/tramites/${request.id}`,
    };
  }
}

function prefsFailure(error: unknown): PrefsError {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return 'unauthorized';
  }
  return failureKind(error);
}
