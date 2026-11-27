import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { EditarProductoComponent } from './editar-productos.component';
import { Producto } from '../interface/producto';

/** Alérgenos en el formulario de productos, probados sobre la clase (sin pintar la plantilla). */
describe('EditarProductoComponent: alérgenos', () => {
  const productoService = { getId: vi.fn(), post: vi.fn(), put: vi.fn() };
  const navigate = vi.fn().mockResolvedValue(true);

  function crear(url: string) {
    return new EditarProductoComponent(
      { params: of({ id: 7 }) } as any,
      new FormBuilder(),
      { url, navigate } as any,
      productoService as any
    );
  }

  beforeEach(() => {
    Object.values(productoService).forEach(f => f.mockReset());
    productoService.post.mockReturnValue(of({}));
    productoService.put.mockReturnValue(of({}));
  });

  it('al editar marca los que tiene y envía la lista con los cambios, en el orden del reglamento', () => {
    const croquetas: Producto = {
      id: 7, nombre: 'Croquetas', descripcion: '', precio: 3, imagen: 'croquetas.jpg', tipoProducto: 'TAPA', alergenos: ['LACTEOS']
    };
    productoService.getId.mockReturnValue(of(croquetas));
    const formulario = crear('/admin/editar-productos/7');
    formulario.ngOnInit();
    expect(formulario.formulario.get('alergenosDeclarados')?.value).toBe(true);
    expect(formulario.formulario.get('alergenos.LACTEOS')?.value).toBe(true);

    formulario.formulario.get('alergenos.GLUTEN')?.setValue(true);
    formulario.guardar();

    const enviado = productoService.put.mock.calls[0][0] as Producto;
    expect(enviado.alergenos).toEqual(['GLUTEN', 'LACTEOS']);
    expect(enviado.tipoProducto).toBe('TAPA');
    expect(enviado).not.toHaveProperty('alergenosDeclarados');
  });

  it('sin marcar «revisada» envía null, aunque haya casillas marcadas', () => {
    productoService.getId.mockReturnValue(of({
      id: 7, nombre: 'Pincho', descripcion: '', precio: 2, imagen: '', tipoProducto: 'TAPA', alergenos: null
    }));
    const formulario = crear('/admin/editar-productos/7');
    formulario.ngOnInit();
    expect(formulario.formulario.get('alergenosDeclarados')?.value).toBe(false);

    formulario.formulario.get('alergenos.HUEVOS')?.setValue(true);
    formulario.guardar();
    expect((productoService.put.mock.calls[0][0] as Producto).alergenos).toBeNull();
  });

  it('un producto nuevo revisado y sin alérgenos se envía con la lista vacía y sin id', () => {
    const formulario = crear('/admin/crear-producto');
    formulario.ngOnInit();
    formulario.formulario.patchValue({ nombre: 'Agua', precio: 1, tipoProducto: 'BEBIDA', alergenosDeclarados: true });

    formulario.guardar();
    const enviado = productoService.post.mock.calls[0][0] as Producto;
    expect(enviado.alergenos).toEqual([]);
    expect(enviado.id).toBeUndefined();
  });

  it('envía las traducciones que se escriben y carga las que ya tiene', () => {
    productoService.getId.mockReturnValue(of({
      id: 9, nombre: 'Tortilla', descripcion: 'De patatas', precio: 3, imagen: '', tipoProducto: 'TAPA', alergenos: null,
      nombrePt: 'Tortilha', nombreEn: null, descripcionPt: null, descripcionEn: null
    }));
    const formulario = crear('/admin/editar-productos/9');
    formulario.ngOnInit();
    expect(formulario.formulario.get('nombrePt')?.value).toBe('Tortilha');

    formulario.formulario.patchValue({ nombreEn: 'Spanish omelette' });
    formulario.guardar();
    const enviado = productoService.put.mock.calls[0][0] as Producto;
    expect(enviado.nombrePt).toBe('Tortilha');
    expect(enviado.nombreEn).toBe('Spanish omelette');
  });
});
