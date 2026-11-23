import { IMAGEN_PRODUCTO_POR_DEFECTO, ponerImagenPorDefecto } from './imagen-por-defecto';

describe('ponerImagenPorDefecto', () => {
  it('pone la imagen por defecto la primera vez y no la vuelve a pedir si también falla', () => {
    const imagen = document.createElement('img');
    imagen.src = 'assets/images/productos/no-existe.jpg';

    ponerImagenPorDefecto({ target: imagen } as unknown as Event, IMAGEN_PRODUCTO_POR_DEFECTO);
    expect(imagen.getAttribute('src')).toBe(IMAGEN_PRODUCTO_POR_DEFECTO);

    imagen.src = 'cambiada-por-otro-motivo.jpg';
    ponerImagenPorDefecto({ target: imagen } as unknown as Event, IMAGEN_PRODUCTO_POR_DEFECTO);
    expect(imagen.getAttribute('src')).toBe('cambiada-por-otro-motivo.jpg');
  });
});
