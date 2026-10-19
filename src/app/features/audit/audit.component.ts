import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-audit',
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent {}
