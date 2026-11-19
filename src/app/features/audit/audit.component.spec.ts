import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';

import { AuditService } from '../../core/audit/audit.service';
import { AuditComponent } from './audit.component';

describe('AuditComponent', () => {
  let harness: RouterTestingHarness;

  const element = () => harness.routeNativeElement as HTMLElement;
  const tab = (label: string) =>
    [...element().querySelectorAll<HTMLAnchorElement>('a[mat-tab-link]')].find((link) =>
      link.textContent?.includes(label),
    )!;
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
  };

  async function open(path: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'audit', component: AuditComponent }]),
        {
          provide: AuditService,
          useValue: { searchEvents: () => NEVER, getTimeline: () => NEVER },
        },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: true, breakpoints: {} }) },
        },
      ],
    });
    harness = await RouterTestingHarness.create(path);
    await settle();
  }

  it('reemplaza el placeholder con la búsqueda de eventos dentro del contenido principal', async () => {
    await open('/audit');
    expect(element().querySelector('main h1')?.textContent).toBe('Auditoría');
    expect(element().querySelector('main app-audit-events')).not.toBeNull();
    expect(element().textContent).not.toContain('Kafka');
    expect(tab('Eventos').getAttribute('aria-selected')).toBe('true');
  });

  it('abre el timeline por la URL', async () => {
    await open('/audit?view=timeline&folio=BD-2026-000412');
    expect(element().querySelector('app-audit-timeline')).not.toBeNull();
    expect(element().querySelector('app-audit-events')).toBeNull();
    expect(tab('Por trámite').getAttribute('aria-selected')).toBe('true');
  });

  it('cada pestaña recuerda su última consulta', async () => {
    await open('/audit?actorRole=Admin');
    await harness.navigateByUrl('/audit?view=timeline&folio=BD-2026-000412');
    await settle();

    expect(TestBed.inject(Router).url).toBe('/audit?view=timeline&folio=BD-2026-000412');
    expect(tab('Eventos').getAttribute('href')).toBe('/audit?actorRole=Admin');
    expect(tab('Por trámite').getAttribute('href')).toBe(
      '/audit?view=timeline&folio=BD-2026-000412',
    );
  });

  it('no tiene acciones de escritura', async () => {
    await open('/audit');
    const labels = [...element().querySelectorAll('button')].map((b) => b.textContent ?? '');
    for (const word of ['Eliminar', 'Editar', 'Guardar', 'Crear']) {
      expect(labels.some((label) => label.includes(word))).toBe(false);
    }
  });
});
