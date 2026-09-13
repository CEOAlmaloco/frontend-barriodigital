import { Routes } from '@angular/router';

import { authGuard, redirectAuthenticatedGuard, roleGuard } from './core/auth/auth.guard';
import { AuthenticatedLayoutComponent } from './core/layout/authenticated-layout.component';
import { LoginComponent } from './features/login/login.component';
import { REQUESTS_ROLES } from './shared/models/role';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LoginComponent,
    canActivate: [redirectAuthenticatedGuard],
    title: 'Iniciar sesión | BarrioDigital',
  },
  // Rutas privadas: van como hijas del layout autenticado, que monta el header y aplica authGuard
  {
    path: '',
    component: AuthenticatedLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'inicio',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
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
    ],
  },
  { path: '**', redirectTo: '' },
];
