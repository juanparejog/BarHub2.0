import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      // Menú, pie y router-outlet tienen sus propios tests; aquí solo importa la estructura
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  it('se llama BarHub', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toBe('BarHub');
  });

  it('pinta el menú, el contenido y el pie en ese orden', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const envoltorio = (fixture.nativeElement as HTMLElement).querySelector('.app-wrapper');
    const hijos = envoltorio ? Array.from(envoltorio.children).map(el => el.tagName.toLowerCase()) : [];
    expect(hijos).toEqual(['app-menu', 'main', 'app-footer']);
    expect(envoltorio?.querySelector('main.app-content router-outlet')).not.toBeNull();
  });
});
