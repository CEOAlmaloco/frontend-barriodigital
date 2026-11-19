import { TestBed } from '@angular/core/testing';

import { ReportRankingComponent } from './report-ranking.component';

describe('ReportRankingComponent', () => {
  function render(ordered: boolean) {
    const fixture = TestBed.createComponent(ReportRankingComponent);
    fixture.componentRef.setInput('items', [
      { label: 'Bache en calle', value: 1200 },
      { label: 'Alumbrado público', value: 300 },
    ]);
    fixture.componentRef.setInput('ordered', ordered);
    fixture.componentRef.setInput('labelledBy', 'titulo');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('como ranking usa una lista ordenada, con barras proporcionales al mayor', () => {
    const element = render(true);
    const list = element.querySelector('ol');
    expect(list?.getAttribute('aria-labelledby')).toBe('titulo');
    const items = Array.from(element.querySelectorAll('li'));
    expect(items[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('1. Bache en calle: 1.200');
    const fills = Array.from(element.querySelectorAll<HTMLElement>('.ranking__fill'));
    expect(fills.map((fill) => fill.style.width)).toEqual(['100%', '25%']);
    expect(element.querySelector('.ranking__track')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sin orden usa una lista simple y no numera', () => {
    const element = render(false);
    expect(element.querySelector('ol')).toBeNull();
    expect(element.querySelector('ul .ranking__rank')).toBeNull();
  });
});
