import { of } from 'rxjs';

import { CartaComponent } from './carta.component';
import { Producto } from '../../admin/pages/productos/interface/producto';
import { traducir, traducirSiExiste } from '../../shared/i18n/textos';

/** Buscador y páginas de la carta, probados sobre la clase (sin pintar la plantilla). */
describe('CartaComponent: búsqueda y páginas', () => {
  let idioma: 'es' | 'en' = 'es';
  const idiomas = {
    idioma: () => idioma,
    t: (clave: any, parametros?: any) => traducir(idioma, clave, parametros),
    tSiExiste: (clave: string, porDefecto: string) => traducirSiExiste(idioma, clave, porDefecto)
  };

  const producto = (id: number, nombre: string, tipoProducto = 'TAPA', cambios: Partial<Producto> = {}): Producto =>
    ({ id, nombre, descripcion: '', precio: 1, imagen: '', tipoProducto, alergenos: [], ...cambios });

  function crear(): CartaComponent {
    return new CartaComponent(
      { isLoggedIn: () => false } as any,
      { get: () => of([]) } as any,
      { get: () => of([]) } as any,
      {} as any,
      { queryParams: of({}) } as any,
      {} as any,
      {} as any,
      idiomas as any
    );
  }

  beforeEach(() => {
    idioma = 'es';
    localStorage.clear();
  });

  it('busca sin distinguir tildes ni mayúsculas, también en la descripción', () => {
    const carta = crear();
    carta.productos = [
      producto(1, 'Café', 'BEBIDA'),
      producto(2, 'Tortilla', 'TAPA', { descripcion: 'De patatas con cebolla' }),
      producto(3, 'Agua', 'BEBIDA')
    ];
    carta.buscar('CAFE');
    expect(carta.productosFiltrados.map(p => p.nombre)).toEqual(['Café']);
    carta.buscar('cebolla');
    expect(carta.productosFiltrados.map(p => p.nombre)).toEqual(['Tortilla']);
    carta.buscar('');
    expect(carta.productosFiltrados.length).toBe(3);
  });

  it('en otro idioma encuentra por el nombre traducido y por el español', () => {
    const carta = crear();
    carta.productos = [producto(1, 'Tortilla', 'TAPA', { nombreEn: 'Spanish omelette' })];
    idioma = 'en';
    carta.buscar('omelette');
    expect(carta.productosFiltrados.length).toBe(1);
    carta.buscar('tortilla');
    expect(carta.productosFiltrados.length).toBe(1);
  });

  it('va por páginas de 24 y vuelve a la primera al buscar o cambiar de categoría', () => {
    const carta = crear();
    carta.productos = Array.from({ length: 30 }, (_, i) => producto(i + 1, `Tapa ${i + 1}`));
    expect(carta.productosPagina.length).toBe(24);

    carta.pagina = 2;
    expect(carta.productosPagina.map(p => p.nombre)).toEqual(['Tapa 25', 'Tapa 26', 'Tapa 27', 'Tapa 28', 'Tapa 29', 'Tapa 30']);

    carta.buscar('Tapa 1');
    expect(carta.pagina).toBe(1);
    carta.pagina = 2;
    carta.filtrarCategoria('tapa');
    expect(carta.pagina).toBe(1);
  });
});
