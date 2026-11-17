package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.service.PedidoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeguimientoControllerTest {

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private PedidoService pedidoService;

    @InjectMocks
    private SeguimientoController controller;

    private int codigo(ResponseEntity<?> r) {
        return r.getStatusCode().value();
    }

    @Test
    void index_devuelve_una_lista_vacia_si_no_hay_pedidos() {
        assertTrue(controller.index().isEmpty());
    }

    @Test
    void create_responde_500_si_falla_el_guardado() {
        lenient().doThrow(new RuntimeException("boom")).when(pedidoService).save(any(Pedido.class));
        assertEquals(500, codigo(controller.create(new PedidoDto())));
    }

    @Test
    void show_responde_400_si_no_se_encuentra() {
        when(pedidoService.findById(1L)).thenThrow(new RuntimeException("no existe"));
        assertEquals(400, codigo(controller.show(1L)));
    }

    @Test
    void update_devuelve_el_pedido_actualizado() {
        Pedido pedido = mock(Pedido.class);
        when(pedidoService.update(eq(1L), any(Pedido.class))).thenReturn(pedido);
        assertEquals(200, codigo(controller.update(1L, pedido)));
    }

    @Test
    void update_da_404_si_el_pedido_no_existe() {
        Pedido pedido = mock(Pedido.class);
        when(pedidoService.update(eq(1L), any(Pedido.class))).thenReturn(null);
        assertEquals(404, codigo(controller.update(1L, pedido)));
    }

    @Test
    void update_responde_500_si_falla() {
        Pedido pedido = mock(Pedido.class);
        when(pedidoService.update(eq(1L), any(Pedido.class))).thenThrow(new RuntimeException("boom"));
        assertEquals(500, codigo(controller.update(1L, pedido)));
    }

    @Test
    void delete_elimina_el_pedido() {
        assertEquals(200, codigo(controller.delete(1L)));
        verify(pedidoService).delete(1L);
    }

    @Test
    void delete_responde_500_si_falla() {
        doThrow(new RuntimeException("boom")).when(pedidoService).delete(1L);
        assertEquals(500, codigo(controller.delete(1L)));
    }

    @Test
    void pedidos_de_un_usuario_incluyen_sus_detalles() {
        DetallePedido detalle = mock(DetallePedido.class, RETURNS_DEEP_STUBS);
        Pedido pedido = mock(Pedido.class);
        doReturn(List.of(detalle)).when(pedido).getDetalles();
        when(pedidoService.findByUsuarioIdWithDetalles(5L)).thenReturn(List.of(pedido));

        ResponseEntity<?> r = controller.getPedidosByUsuario(5L);
        assertEquals(200, codigo(r));
        assertEquals(1, ((List<?>) r.getBody()).size());
    }

    @Test
    void pedidos_de_un_usuario_sin_pedidos_devuelve_lista_vacia() {
        when(pedidoService.findByUsuarioIdWithDetalles(5L)).thenReturn(List.of());
        ResponseEntity<?> r = controller.getPedidosByUsuario(5L);
        assertEquals(200, codigo(r));
        assertTrue(((List<?>) r.getBody()).isEmpty());
    }

    @Test
    void pedidos_de_un_usuario_responde_404_si_falla() {
        when(pedidoService.findByUsuarioIdWithDetalles(5L)).thenThrow(new RuntimeException("boom"));
        assertEquals(404, codigo(controller.getPedidosByUsuario(5L)));
    }
}
