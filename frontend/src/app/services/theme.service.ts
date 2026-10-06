import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private darkModeSubject = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.darkModeSubject.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initTheme();
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.setDarkMode(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark);
    }
  }

  public toggleTheme(): void {
    this.setDarkMode(!this.darkModeSubject.value);
  }

  public setDarkMode(isDark: boolean): void {
    this.darkModeSubject.next(isDark);
    if (isDark) {
      this.renderer.addClass(document.body, 'dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }
}