import { Routes } from '@angular/router';

import {
  accessGuard,
  authGuard,
  noAccessGuard,
  redirectAuthenticatedGuard,
  roleGuard,
} from './core/auth/auth.guard';
import { AuthenticatedLayoutComponent } from './core/layout/authenticated-layout.component';
import { LoginComponent } from './features/login/login.component';
import { OVERSIGHT_ROLES, REQUESTS_ROLES, Role } from './shared/models/role';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LoginComponent,
    canActivate: [redirectAuthenticatedGuard],
    title: 'Iniciar sesión | BarrioDigital',
  },
  // Fuera del layout: sin un rol válido no hay navegación que mostrar
  {
    path: 'no-access',
    canActivate: [authGuard, noAccessGuard],
    loadComponent: () =>
      import('./features/no-access/no-access.component').then((m) => m.NoAccessComponent),
    title: 'Sin acceso | BarrioDigital',
  },
  // Rutas privadas: hijas del layout autenticado, que monta el header. accessGuard corre después de authGuard
  {
    path: '',
    component: AuthenticatedLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [accessGuard],
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
        title: 'Inicio | BarrioDigital',
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
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: [Role.Admin] },
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
        title: 'Administración | BarrioDigital',
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: OVERSIGHT_ROLES },
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
        title: 'Reportes | BarrioDigital',
      },
      {
        path: 'audit',
        canActivate: [roleGuard],
        data: { roles: OVERSIGHT_ROLES },
        loadComponent: () =>
          import('./features/audit/audit.component').then((m) => m.AuditComponent),
        title: 'Auditoría | BarrioDigital',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
