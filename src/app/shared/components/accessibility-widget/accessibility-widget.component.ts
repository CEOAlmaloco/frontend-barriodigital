import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';

import { AccessibilityService } from '../../../core/accessibility/accessibility.service';
import type { ContrastMode } from '../../../core/accessibility/accessibility.model';

/** Panel fijo de accesibilidad. Las opciones se aplican al documento, no a un solo rol. */
@Component({
  selector: 'app-accessibility-widget',
  templateUrl: './accessibility-widget.component.html',
  styleUrl: './accessibility-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessibilityWidgetComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly accessibility = inject(AccessibilityService);

  protected readonly isOpen = signal(false);
  private readonly firstAction = viewChild<ElementRef<HTMLButtonElement>>('firstAction');

  protected textLabel(): string {
    const labels = ['87%', '100%', '112%', '125%', '137%', '150%'];
    return labels[this.accessibility.preferences().textStep + 1] ?? '100%';
  }

  protected isContrast(mode: ContrastMode): boolean {
    return this.accessibility.preferences().contrast === mode;
  }

  protected togglePanel(): void {
    const willOpen = !this.isOpen();
    this.isOpen.set(willOpen);
    if (willOpen) {
      setTimeout(() => this.firstAction()?.nativeElement.focus());
    }
  }

  protected closePanel(): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.closePanel();
    }
  }

  protected onEscape(): void {
    if (!this.isOpen()) {
      return;
    }
    this.closePanel();
    this.host.nativeElement.querySelector('button')?.focus();
  }

  protected increaseText(): void {
    this.accessibility.increaseText();
  }

  protected decreaseText(): void {
    this.accessibility.decreaseText();
  }

  protected setContrast(mode: ContrastMode): void {
    this.accessibility.setContrast(mode);
  }

  protected toggleGrayscale(): void {
    this.accessibility.toggleGrayscale();
  }

  protected toggleReadableFont(): void {
    this.accessibility.toggleReadableFont();
  }

  protected toggleUnderlineLinks(): void {
    this.accessibility.toggleUnderlineLinks();
  }

  protected togglePauseMotion(): void {
    this.accessibility.togglePauseMotion();
  }

  protected reset(): void {
    this.accessibility.reset();
  }
}
