import { Routes } from '@angular/router';

import {
  accessGuard,
  authGuard,
  noAccessGuard,
  redirectAuthenticatedGuard,
  roleGuard,
} from './core/auth/auth.guard';
import { OVERSIGHT_ROLES, REPORTS_ROLES, REQUESTS_ROLES, Role } from './shared/models/role';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
    canActivate: [redirectAuthenticatedGuard],
    title: 'Iniciar sesión | BarrioDigital',
  },
  // Información pública: se lee con o sin sesión
  {
    path: 'legal',
    loadComponent: () =>
      import('./features/legal/legal-layout/legal-layout.component').then(
        (m) => m.LegalLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'privacidad' },
      {
        path: 'privacidad',
        loadComponent: () =>
          import('./features/legal/privacy-notice/privacy-notice.component').then(
            (m) => m.PrivacyNoticeComponent,
          ),
        title: 'Aviso de privacidad | BarrioDigital',
      },
      {
        path: 'accesibilidad',
        loadComponent: () =>
          import('./features/legal/accessibility-statement/accessibility-statement.component').then(
            (m) => m.AccessibilityStatementComponent,
          ),
        title: 'Declaración de accesibilidad | BarrioDigital',
      },
      {
        path: 'condiciones-de-uso',
        loadComponent: () =>
          import('./features/legal/terms-of-use/terms-of-use.component').then(
            (m) => m.TermsOfUseComponent,
          ),
        title: 'Condiciones de uso | BarrioDigital',
      },
    ],
  },

  // Fuera del layout: sin un rol válido no hay navegación que mostrar
  {
    path: 'sin-acceso',
    canActivate: [authGuard, noAccessGuard],
    loadComponent: () =>
      import('./features/no-access/no-access.component').then((m) => m.NoAccessComponent),
    title: 'Sin acceso | BarrioDigital',
  },
  // Rutas privadas: hijas del layout autenticado, que monta el header. accessGuard corre después de authGuard
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/authenticated-layout.component').then(
        (m) => m.AuthenticatedLayoutComponent,
      ),
    canActivate: [authGuard],
    canActivateChild: [accessGuard],
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
        title: 'Inicio | BarrioDigital',
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
        title: 'Mi perfil | BarrioDigital',
      },
      {
        path: 'tramites',
        canActivate: [roleGuard],
        data: { roles: REQUESTS_ROLES },
        loadComponent: () =>
          import('./features/requests/requests.component').then((m) => m.RequestsComponent),
        title: 'Trámites | BarrioDigital',
      },
      {
        path: 'tramites/:id',
        canActivate: [roleGuard],
        data: { roles: REQUESTS_ROLES },
        loadComponent: () =>
          import('./features/requests/request-detail/request-detail.component').then(
            (m) => m.RequestDetailComponent,
          ),
        title: 'Detalle del trámite | BarrioDigital',
      },
      {
        path: 'administracion',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin] },
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
        title: 'Administración | BarrioDigital',
      },
      {
        path: 'reportes',
        canActivate: [roleGuard],
        data: { roles: REPORTS_ROLES },
        loadComponent: () =>
          import('./features/reports/reports-layout/reports-layout.component').then(
            (m) => m.ReportsLayoutComponent,
          ),
        children: [
          {
            path: '',
            pathMatch: 'full',
            canActivate: [roleGuard],
            data: { roles: OVERSIGHT_ROLES, deniedRedirect: '/reportes/mapa' },
            loadComponent: () =>
              import('./features/reports/reports.component').then((m) => m.ReportsComponent),
            title: 'Reportes | BarrioDigital',
          },
          {
            path: 'mapa',
            loadComponent: () =>
              import('./features/reports/report-map/report-map.component').then(
                (m) => m.ReportMapComponent,
              ),
            title: 'Mapa de trámites | BarrioDigital',
          },
        ],
      },
      {
        path: 'auditoria',
        canActivate: [roleGuard],
        data: { roles: OVERSIGHT_ROLES },
        loadComponent: () =>
          import('./features/audit/audit.component').then((m) => m.AuditComponent),
        title: 'Auditoría | BarrioDigital',
      },
    ],
  },
  // Rutas anteriores en inglés: los enlaces guardados siguen funcionando
  { path: 'no-access', redirectTo: 'sin-acceso' },
  { path: 'admin', redirectTo: 'administracion' },
  { path: 'reports/map', redirectTo: 'reportes/mapa' },
  { path: 'reports', redirectTo: 'reportes' },
  { path: 'audit', redirectTo: 'auditoria' },
  { path: '**', redirectTo: '' },
];
