import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly renderer: Renderer2;
  private readonly darkModeSubject = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.darkModeSubject.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initTheme();
  }

  /**
   * La primera visita siempre en modo claro, tenga el sistema el tema que tenga. Si el visitante
   * cambia al oscuro, se recuerda en este navegador.
   */
  private initTheme(): void {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem('theme');
    } catch {
      // Sin almacenamiento: modo claro
    }
    this.setDarkMode(guardado === 'dark');
  }

  public toggleTheme(): void {
    this.setDarkMode(!this.darkModeSubject.value);
  }

  public setDarkMode(isDark: boolean): void {
    this.darkModeSubject.next(isDark);
    // Modo de color nativo de Bootstrap 5.3: sus componentes leen este atributo
    this.renderer.setAttribute(document.documentElement, 'data-bs-theme', isDark ? 'dark' : 'light');
    if (isDark) {
      this.renderer.addClass(document.body, 'dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }
}