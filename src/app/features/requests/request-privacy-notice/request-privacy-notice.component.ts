import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * Aviso por capas del alta: una línea visible y el detalle a demanda. Informa y no pide aceptación, porque la
 * municipalidad trata estos datos dentro de su competencia (Ley 19.628, art. 20).
 */
@Component({
  selector: 'app-request-privacy-notice',
  imports: [MatIcon],
  templateUrl: './request-privacy-notice.component.html',
  styleUrl: './request-privacy-notice.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestPrivacyNoticeComponent {}
