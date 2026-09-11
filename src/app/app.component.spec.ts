import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';

describe('AppComponent', () => {
  const auth = { handleRedirect: vi.fn(() => of(null)) };

  beforeEach(async () => {
    auth.handleRedirect.mockClear();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('procesa la respuesta de Entra ID al iniciar', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(auth.handleRedirect).toHaveBeenCalledTimes(1);
  });
});
