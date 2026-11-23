import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-accessibility-statement',
  templateUrl: './accessibility-statement.component.html',
  styleUrl: '../legal-document.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessibilityStatementComponent {
  protected readonly supportEmail = environment.supportEmail;
}
