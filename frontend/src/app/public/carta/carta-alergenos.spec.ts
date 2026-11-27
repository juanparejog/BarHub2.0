import { of } from 'rxjs';
import { vi } from 'vitest';

import { CartaComponent } from './carta.component';
import { Producto } from '../../admin/pages/productos/interface/producto';
import { traducir, traducirSiExiste } from '../../shared/i18n/textos';

/** El idioma, fijo en español para estos tests. */
const enEspanol = {
  idioma: () => 'es',
  t: (clave: any, parametros?: any) => traducir('es', clave, parametros),
  tSiExiste: (clave: string, porDefecto: string) => traducirSiExiste('es', clave, porDefecto)
};

/** Filtro de alérgenos de la carta y mesa del QR, probados sobre la clase (sin pintar la plantilla). */
describe('CartaComponent: alérgenos y mesa del QR', () => {
  const producto = (nombre: string, tipoProducto: string, alergenos: string[] | null): Producto =>
    ({ id: nombre.length, nombre, descripcion: '', precio: 1, imagen: '', tipoProducto, alergenos });

  function crear(parametros: Record<string, string> = {}) {
    const carta = new CartaComponent(
      { isLoggedIn: () => false } as any,
      { get: () => of([]) } as any,
      { get: () => of([]) } as any,
      {} as any,
      { queryParams: of(parametros) } as any,
      {} as any,
      {} as any,
      enEspanol as any
    );
    vi.spyOn(carta, 'showToastMessage').mockImplementation(() => undefined);
    return carta;
  }

  beforeEach(() => localStorage.clear());

  it('sin filtro se ven todos; al excluir gluten se esconde lo que lo lleva y lo que no tiene información', () => {
    const carta = crear();
    carta.productos = [
      producto('Croquetas', 'TAPA', ['GLUTEN', 'LACTEOS']),
      producto('Agua', 'BEBIDA', []),
      producto('Pincho', 'TAPA', null),
      producto('Flan', 'POSTRE', ['HUEVOS', 'LACTEOS'])
    ];
    expect(carta.productosFiltrados.map(p => p.nombre)).toEqual(['Croquetas', 'Agua', 'Pincho', 'Flan']);

    carta.alternarAlergeno('GLUTEN');
    expect(carta.productosFiltrados.map(p => p.nombre)).toEqual(['Agua', 'Flan']);
    expect(carta.ocultosPorAlergenos).toEqual({ total: 2, sinInformacion: 1 });

    carta.categoriaSeleccionada = 'postre';
    expect(carta.productosFiltrados.map(p => p.nombre)).toEqual(['Flan']);

    carta.alternarAlergeno('GLUTEN');
    carta.categoriaSeleccionada = 'todos';
    expect(carta.productosFiltrados.length).toBe(4);
  });

  it('recuerda los alérgenos elegidos en este navegador e ignora lo que no sea un alérgeno', () => {
    crear().alternarAlergeno('SESAMO');
    expect(crear().alergenosExcluidos.has('SESAMO')).toBe(true);

    localStorage.setItem('barhub.alergenosExcluidos', JSON.stringify(['SESAMO', '<script>', 7]));
    expect([...crear().alergenosExcluidos]).toEqual(['SESAMO']);

    localStorage.setItem('barhub.alergenosExcluidos', 'esto no es json');
    expect(crear().alergenosExcluidos.size).toBe(0);
  });

  it('el QR de una mesa la deja elegida; uno que no es un número no', () => {
    const conMesa = crear({ mesa: '3' });
    conMesa.ngOnInit();
    expect(conMesa.idMesa).toBe(3);
    expect(conMesa.mesaBloqueadaPorQr).toBe(true);

    const raro = crear({ mesa: 'QR001' });
    raro.ngOnInit();
    expect(raro.idMesa).toBeNull();
    expect(raro.mesaBloqueadaPorQr).toBe(false);
    expect(raro.showToastMessage).toHaveBeenCalledWith(expect.stringContaining('no es válido'), 'error');
  });
});
