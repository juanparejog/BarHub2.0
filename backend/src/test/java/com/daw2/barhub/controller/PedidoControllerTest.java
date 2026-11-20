package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.service.PedidoService;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PedidoControllerTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Mock
    private PedidoService pedidoService;

    private PedidoController controller;

    @BeforeEach
    void preparar() {
        controller = new PedidoController(pedidoService);
    }

    private int codigo(ResponseEntity<?> r) {
        return r.getStatusCode().value();
    }

    /** Construye el DTO desde JSON: asi el test no depende del tipo exacto de cada campo. */
    private PedidoDto dto(String json) throws Exception {
        return JSON.readValue(json, PedidoDto.class);
    }

    private Authentication como(String usuario) {
        return new UsernamePasswordAuthenticationToken(usuario, null,
                List.of(new SimpleGrantedAuthority("ROLE_CLIENTE")));
    }

    private Authentication anonimo() {
        return new AnonymousAuthenticationToken("clave", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
    }

    // ---------- listados ----------

    @Test
    void index_devuelve_200() {
        assertEquals(200, codigo(controller.index()));
    }

    @Test
    void pendientes_de_efectivo_devuelve_200() {
        assertEquals(200, codigo(controller.getPendientesEfectivo()));
    }

    @Test
    void mis_pedidos_usa_el_usuario_autenticado() {
        assertEquals(200, codigo(controller.misPedidos(como("juan"))));
        verify(pedidoService).findByUsername("juan");
    }

    @Test
    void mis_pedidos_responde_500_si_falla() {
        when(pedidoService.findByUsername("juan")).thenThrow(new RuntimeException("boom"));
        assertEquals(500, codigo(controller.misPedidos(como("juan"))));
    }

    // ---------- crear: validaciones ----------

    @Test
    void crear_exige_el_tipo_de_pedido() throws Exception {
        assertEquals(400, codigo(controller.create(dto("{}"), como("juan"))));
    }

    @Test
    void un_pedido_en_mesa_exige_la_mesa() throws Exception {
        assertEquals(400, codigo(controller.create(dto("{\"tipoPedido\":\"MESA\"}"), como("juan"))));
    }

    @Test
    void un_pedido_a_domicilio_exige_direccion() throws Exception {
        assertEquals(400, codigo(controller.create(dto("{\"tipoPedido\":\"DOMICILIO\"}"), como("juan"))));
    }

    @Test
    void una_direccion_en_blanco_tampoco_vale() throws Exception {
        String json = "{\"tipoPedido\":\"DOMICILIO\",\"direccionEnvio\":\"   \"}";
        assertEquals(400, codigo(controller.create(dto(json), como("juan"))));
    }

    // ---------- crear: errores del servicio y usuario ----------

    @Test
    void un_mensaje_del_servicio_se_devuelve_como_400() throws Exception {
        when(pedidoService.crearPedidoSeguro(any(PedidoDto.class), any()))
                .thenThrow(new IllegalArgumentException("Producto agotado"));
        assertEquals(400, codigo(controller.create(dto("{\"tipoPedido\":\"RECOGER\"}"), como("juan"))));
    }

    @Test
    void un_fallo_inesperado_responde_500() throws Exception {
        when(pedidoService.crearPedidoSeguro(any(PedidoDto.class), any()))
                .thenThrow(new RuntimeException("boom"));
        String json = "{\"tipoPedido\":\"DOMICILIO\",\"direccionEnvio\":\"Calle Mayor 1\"}";
        assertEquals(500, codigo(controller.create(dto(json), como("juan"))));
    }

    @Test
    void el_pedido_se_asocia_al_usuario_autenticado() throws Exception {
        when(pedidoService.crearPedidoSeguro(any(PedidoDto.class), any()))
                .thenThrow(new RuntimeException("boom"));
        controller.create(dto("{\"tipoPedido\":\"RECOGER\"}"), como("juan"));
        verify(pedidoService).crearPedidoSeguro(any(PedidoDto.class), eq("juan"));
    }

    @Test
    void un_pedido_anonimo_no_se_asocia_a_ningun_usuario() throws Exception {
        when(pedidoService.crearPedidoSeguro(any(PedidoDto.class), any()))
                .thenThrow(new RuntimeException("boom"));
        controller.create(dto("{\"tipoPedido\":\"RECOGER\"}"), anonimo());
        verify(pedidoService).crearPedidoSeguro(any(PedidoDto.class), isNull());
    }

    @Test
    void sin_autenticacion_el_pedido_tampoco_tiene_usuario() throws Exception {
        when(pedidoService.crearPedidoSeguro(any(PedidoDto.class), any()))
                .thenThrow(new RuntimeException("boom"));
        controller.create(dto("{\"tipoPedido\":\"RECOGER\"}"), null);
        verify(pedidoService).crearPedidoSeguro(any(PedidoDto.class), isNull());
    }

    // ---------- consultar, actualizar y borrar ----------

    @Test
    void show_da_404_si_no_existe() {
        when(pedidoService.findById(1L)).thenReturn(null);
        assertEquals(404, codigo(controller.show(1L)));
    }

    @Test
    void show_responde_400_si_falla() {
        when(pedidoService.findById(1L)).thenThrow(new RuntimeException("boom"));
        assertEquals(400, codigo(controller.show(1L)));
    }

    @Test
    void update_da_404_si_no_existe() throws Exception {
        when(pedidoService.updateFromDto(eq(1L), any(PedidoDto.class))).thenReturn(null);
        assertEquals(404, codigo(controller.update(1L, dto("{}"))));
    }

    @Test
    void update_responde_500_si_falla() throws Exception {
        when(pedidoService.updateFromDto(eq(1L), any(PedidoDto.class))).thenThrow(new RuntimeException("boom"));
        assertEquals(500, codigo(controller.update(1L, dto("{}"))));
    }

    @Test
    void delete_elimina_el_pedido() {
        assertEquals(200, codigo(controller.delete(1L)));
        verify(pedidoService).delete(1L);
    }

    @Test
    void delete_responde_404_si_falla() {
        doThrow(new RuntimeException("boom")).when(pedidoService).delete(1L);
        assertEquals(404, codigo(controller.delete(1L)));
    }
}
