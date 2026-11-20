import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { AccessibilityWidgetComponent } from './shared/components/accessibility-widget/accessibility-widget.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AccessibilityWidgetComponent],
  template: `
    <div class="app-shell">
      <router-outlet />
    </div>
    <app-accessibility-widget />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.auth.handleRedirect().subscribe();
  }
}
