import { Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { GestionarComandasComponent } from './gestionar-comandas.component';

/** Pantalla de comandas: recarga con los avisos, pitido con las nuevas e impresión del ticket. */
describe('GestionarComandasComponent', () => {
  const sonar = vi.fn();
  const detectChanges = vi.fn();
  let avisos: Subject<void>;
  let respuestas: any[][];

  const productos = [
    { id: 1, nombre: 'Croquetas', alergenos: ['GLUTEN', 'LACTEOS'] },
    { id: 2, nombre: 'Agua', alergenos: [] },
    { id: 3, nombre: 'Especial', alergenos: null }
  ];

  function crear() {
    return new GestionarComandasComponent(
      { getByPedidoId: () => of([]) } as any,
      { get: () => of(respuestas.shift() ?? []) } as any,
      { get: () => of(productos) } as any,
      { recargas: () => avisos } as any,
      { sonar, activado: true } as any,
      { detectChanges, markForCheck: vi.fn() } as any,
      { flotante: vi.fn() } as any
    );
  }

  const pedido = (id: number, estado = 'pendiente') => ({
    id, estado, tipoPedido: 'MESA', mesaId: 4, fecha: '2026-11-24T12:30:00',
    detalles: [{ id_producto: 1, cantidad: 2, producto: { nombre: 'Croquetas' }, notas: 'sin sal' }]
  });

  beforeEach(() => {
    sonar.mockReset();
    detectChanges.mockReset();
    avisos = new Subject<void>();
    respuestas = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.classList.remove('imprimiendo-comanda');
  });

  it('recarga con cada aviso, quita las servidas y solo pita con las comandas nuevas', () => {
    respuestas = [[pedido(1)], [pedido(1), pedido(2)], [pedido(1, 'servido'), pedido(2)]];
    const pantalla = crear();
    pantalla.ngOnInit();

    avisos.next();
    expect(pantalla.pedidos.map(p => p.id)).toEqual([1]);
    expect(sonar).not.toHaveBeenCalled();

    avisos.next();
    expect(pantalla.pedidos.map(p => p.id)).toEqual([1, 2]);
    expect(sonar).toHaveBeenCalledTimes(1);
    expect(pantalla.anuncioComandas).toBe('Nueva comanda: pedido 2');

    avisos.next();
    expect(pantalla.pedidos.map(p => p.id)).toEqual([2]);
    expect(sonar).toHaveBeenCalledTimes(1);

    pantalla.ngOnDestroy();
    avisos.next();
    expect(pantalla.pedidos.map(p => p.id)).toEqual([2]);
  });

  it('da los alérgenos de cada línea por nombre, y null si el producto no los tiene indicados', () => {
    const pantalla = crear();
    pantalla.ngOnInit();
    expect(pantalla.alergenosDe({ id_producto: 1 })).toEqual(['Gluten', 'Lácteos']);
    expect(pantalla.alergenosDe({ id_producto: 2 })).toEqual([]);
    expect(pantalla.alergenosDe({ id_producto: 3 })).toBeNull();
    expect(pantalla.alergenosDe({ id_producto: 99 })).toBeNull();
  });

  it('imprime solo la comanda elegida y lo deja todo como estaba al terminar', () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body.classList.contains('imprimiendo-comanda')).toBe(true);
    });
    const pantalla = crear();
    const comanda = pedido(5);

    pantalla.imprimir(comanda);
    expect(pantalla.comandaImpresa).toBe(comanda);
    expect(detectChanges).toHaveBeenCalled();
    expect(imprimir).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('imprimiendo-comanda')).toBe(false);
    expect(pantalla.comandaImpresa).toBeNull();
  });
});
