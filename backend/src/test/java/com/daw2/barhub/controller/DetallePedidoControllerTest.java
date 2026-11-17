package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.repository.DetallePedidoRepository;
import com.daw2.barhub.service.DetallePedidoService;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DetallePedidoControllerTest {

    @Mock
    private DetallePedidoRepository detallePedidoRepository;

    @Mock
    private DetallePedidoService detallePedidoService;

    @InjectMocks
    private DetallePedidoController controller;

    private int codigo(ResponseEntity<?> r) {
        return r.getStatusCode().value();
    }

    @Test
    void index_devuelve_una_lista_vacia_si_no_hay_detalles() {
        assertTrue(controller.index().isEmpty());
    }

    @Test
    void create_responde_500_si_falla_el_guardado() {
        lenient().doThrow(new RuntimeException("boom")).when(detallePedidoService).save(any(DetallePedido.class));
        assertEquals(500, codigo(controller.create(new DetallePedidoDto())));
    }

    @Test
    void show_responde_400_si_no_se_encuentra() {
        when(detallePedidoService.findById(1L)).thenThrow(new RuntimeException("no existe"));
        assertEquals(400, codigo(controller.show(1L)));
    }

    @Test
    void update_devuelve_el_detalle_actualizado() {
        DetallePedido detalle = mock(DetallePedido.class);
        when(detallePedidoService.update(eq(1L), any(DetallePedido.class))).thenReturn(detalle);
        assertEquals(200, codigo(controller.update(1L, detalle)));
    }

    @Test
    void update_da_404_si_no_existe() {
        DetallePedido detalle = mock(DetallePedido.class);
        when(detallePedidoService.update(eq(1L), any(DetallePedido.class))).thenReturn(null);
        assertEquals(404, codigo(controller.update(1L, detalle)));
    }

    @Test
    void update_responde_500_si_falla() {
        DetallePedido detalle = mock(DetallePedido.class);
        when(detallePedidoService.update(eq(1L), any(DetallePedido.class))).thenThrow(new RuntimeException("boom"));
        assertEquals(500, codigo(controller.update(1L, detalle)));
    }

    @Test
    void delete_elimina_el_detalle() {
        assertEquals(200, codigo(controller.delete(1L)));
        verify(detallePedidoService).delete(1L);
    }

    @Test
    void delete_responde_404_si_falla() {
        doThrow(new RuntimeException("boom")).when(detallePedidoService).delete(1L);
        assertEquals(404, codigo(controller.delete(1L)));
    }

    @Test
    void detalles_de_un_pedido_se_leen_del_repositorio() {
        DetallePedido detalle = mock(DetallePedido.class);
        when(detallePedidoRepository.findByPedidoId(3L)).thenReturn(List.of(detalle));
        ResponseEntity<List<DetallePedido>> r = controller.getDetallesByPedidoId(3L);
        assertEquals(200, codigo(r));
        assertEquals(1, r.getBody().size());
    }
}
