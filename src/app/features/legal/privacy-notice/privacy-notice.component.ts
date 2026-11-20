import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { focusRouteFragment } from '../focus-route-fragment';

export const PRIVACY_SECTIONS = [
  { id: 'responsable', label: 'Responsable' },
  { id: 'datos', label: 'Qué datos tratamos' },
  { id: 'finalidades', label: 'Para qué los usamos' },
  { id: 'fundamento', label: 'Fundamento legal' },
  { id: 'acceso', label: 'Quién accede y con quién se comparten' },
  { id: 'conservacion', label: 'Cuánto tiempo se conservan' },
  { id: 'derechos', label: 'Tus derechos' },
  { id: 'navegador', label: 'Datos guardados en tu navegador' },
  { id: 'cambios', label: 'Cambios a este aviso' },
] as const;

/**
 * Aviso de privacidad por capas: un resumen y el detalle por tema. Informa y no pide aceptación, porque la
 * municipalidad trata estos datos dentro de su competencia (Ley 19.628, art. 20).
 */
@Component({
  selector: 'app-privacy-notice',
  imports: [RouterLink],
  templateUrl: './privacy-notice.component.html',
  styleUrl: '../legal-document.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyNoticeComponent {
  protected readonly sections = PRIVACY_SECTIONS;
  protected readonly supportEmail = environment.supportEmail;

  constructor() {
    focusRouteFragment();
  }
}
