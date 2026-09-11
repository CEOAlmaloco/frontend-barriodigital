import { Routes } from '@angular/router';

import { redirectAuthenticatedGuard } from './core/auth/auth.guard';
import { LoginComponent } from './features/login/login.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LoginComponent,
    canActivate: [redirectAuthenticatedGuard],
    title: 'Iniciar sesión | BarrioDigital',
  },
  {
    path: 'inicio',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Inicio | BarrioDigital',
  },
  { path: '**', redirectTo: '' },
];
