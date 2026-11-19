import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessibilityWidgetComponent } from './accessibility-widget.component';

describe('AccessibilityWidgetComponent', () => {
  let fixture: ComponentFixture<AccessibilityWidgetComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    delete document.documentElement.dataset['bdScale'];
    delete document.documentElement.dataset['bdContrast'];

    await TestBed.configureTestingModule({
      imports: [AccessibilityWidgetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessibilityWidgetComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('abre el panel y aumenta el texto de la página', () => {
    const launcher = element.querySelector('.a11y__launcher') as HTMLButtonElement;
    launcher.click();
    fixture.detectChanges();

    const increase = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Aumentar texto'),
    ) as HTMLButtonElement;
    increase.click();
    fixture.detectChanges();

    expect(element.querySelector('.a11y__status')?.textContent).toContain('112%');
    expect(document.documentElement.dataset['bdScale']).toBe('1');
  });

  it('restablecer vuelve el texto al 100%', () => {
    const launcher = element.querySelector('.a11y__launcher') as HTMLButtonElement;
    launcher.click();
    fixture.detectChanges();
    (Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Aumentar texto'),
    ) as HTMLButtonElement).click();
    (Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Restablecer'),
    ) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('.a11y__status')?.textContent).toContain('100%');
    expect(document.documentElement.dataset['bdScale']).toBeUndefined();
  });
});
