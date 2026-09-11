import { Routes } from '@angular/router';

import { authGuard, redirectAuthenticatedGuard } from './core/auth/auth.guard';
import { LoginComponent } from './features/login/login.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: LoginComponent,
    canActivate: [redirectAuthenticatedGuard],
    title: 'Iniciar sesión | BarrioDigital',
  },
  // Rutas privadas: cada una lleva canActivate: [authGuard]
  {
    path: 'inicio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Inicio | BarrioDigital',
  },
  { path: '**', redirectTo: '' },
];
