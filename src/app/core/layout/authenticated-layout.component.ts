import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HeaderComponent } from '../../shared/components/header/header.component';

/** Contenedor de las rutas autenticadas: el header se monta una sola vez y las páginas van debajo. */
@Component({
  selector: 'app-authenticated-layout',
  imports: [HeaderComponent, RouterOutlet],
  template: '<app-header /><router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent {}
