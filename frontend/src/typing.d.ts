// Bootstrap 5 se carga como script global (bootstrap.bundle en angular.json).
// Tipos mínimos de lo que usa DialogService.
interface BootstrapInstancia {
  show(): void;
  hide(): void;
}

declare const bootstrap: {
  Modal: { getOrCreateInstance(elemento: Element): BootstrapInstancia };
  Toast: { getOrCreateInstance(elemento: Element): BootstrapInstancia };
};
