import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-terms-of-use',
  imports: [RouterLink],
  templateUrl: './terms-of-use.component.html',
  styleUrl: '../legal-document.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsOfUseComponent {
  protected readonly supportEmail = environment.supportEmail;
}
