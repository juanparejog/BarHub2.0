package com.daw2.barhub.service.impl;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.enums.EstadoPago;
import com.daw2.barhub.model.enums.EstadoPedido;
import com.daw2.barhub.model.enums.TipoPedido;
import com.daw2.barhub.model.repository.MesaRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.ProductoRepository;
import com.daw2.barhub.pago.PagoRechazadoException;
import com.daw2.barhub.pago.VerificacionPago;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PedidoServiceImplTest {

    @Mock
    private PedidoRepository pedidoRepository;
    @Mock
    private MesaRepository mesaRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProductoRepository productoRepository;
    @Mock
    private VerificacionPago verificacionPago;

    @InjectMocks
    private PedidoServiceImpl servicio;

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    // ---------- utilidades ----------

    private static DetallePedidoDto linea(Long idProducto, Integer cantidad) {
        DetallePedidoDto detalle = new DetallePedidoDto();
        detalle.setIdProducto(idProducto);
        detalle.setCantidad(cantidad);
        detalle.setPrecioUnitario(new BigDecimal("0.01")); // el cliente intenta fijar el precio
        return detalle;
    }

    private static PedidoDto pedidoDto(TipoPedido tipo, String metodoPago, DetallePedidoDto... lineas) {
        PedidoDto dto = new PedidoDto();
        dto.setTipoPedido(tipo);
        dto.setMetodoPago(metodoPago);
        dto.setDetalles(new ArrayList<>(List.of(lineas)));
        return dto;
    }

    private static Producto producto(Long id, double precio) {
        Producto producto = new Producto();
        producto.setId(id);
        producto.setPrecio(precio);
        return producto;
    }

    private void guardarDevuelveLoRecibido() {
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));
    }

    // ---------- crearPedidoSeguro ----------

    @Test
    void pedidoEnMesaCalculaElTotalConLosPreciosDeLaBaseDeDatos() {
        Long mesaId = 3L;
        Long productoId = 10L;
        Mesa mesa = new Mesa();
        mesa.setId(mesaId);
        when(mesaRepository.findById(mesaId)).thenReturn(Optional.of(mesa));
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 2.5)));
        guardarDevuelveLoRecibido();

        PedidoDto dto = pedidoDto(TipoPedido.MESA, "efectivo", linea(productoId, 2));
        dto.setIdMesa(mesaId);

        Pedido pedido = servicio.crearPedidoSeguro(dto, null);

        assertEquals(0, new BigDecimal("5.00").compareTo(pedido.getPrecioTotal()));
        assertEquals(1, pedido.getDetalles().size());
        assertEquals(0, new BigDecimal("2.50").compareTo(pedido.getDetalles().get(0).getPrecioUnitario()));
        assertSame(mesa, pedido.getMesa());
        assertEquals(TipoPedido.MESA, pedido.getTipoPedido());
    }

    @Test
    void elEstadoInicialNoLoDecideElCliente() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.0)));
        guardarDevuelveLoRecibido();

        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1));
        for (EstadoPedido estado : EstadoPedido.values()) {
            if (estado != EstadoPedido.PENDIENTE) {
                dto.setEstado(estado);
                break;
            }
        }

        Pedido pedido = servicio.crearPedidoSeguro(dto, null);

        assertEquals(EstadoPedido.PENDIENTE, pedido.getEstado());
    }

    @Test
    void conTarjetaSoloQuedaPagadoSiStripeConfirmaElPagoPorElTotalDelServidor() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.5)));
        guardarDevuelveLoRecibido();
        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "TARJETA", linea(productoId, 2));
        dto.setPagoId("pi_pagado12345678");

        Pedido pedido = servicio.crearPedidoSeguro(dto, null);

        verify(verificacionPago).comprobar(eq("pi_pagado12345678"), eq(new BigDecimal("3.00")), anyList(), isNull());
        assertEquals(EstadoPago.COMPLETADO, pedido.getEstadoPago());
        assertEquals("pi_pagado12345678", pedido.getPagoId());
    }

    @Test
    void conTarjetaSinPagoValidoNoSeGuardaElPedido() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.0)));
        doThrow(new PagoRechazadoException(HttpStatus.PAYMENT_REQUIRED, "El pago con tarjeta no se ha completado."))
                .when(verificacionPago).comprobar(any(), any(), anyList(), any());

        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "tarjeta", linea(productoId, 1));
        assertThrows(PagoRechazadoException.class, () -> servicio.crearPedidoSeguro(dto, null));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void enEfectivoQuedaPendienteAunqueElClienteDigaQueEstaPagado() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.0)));
        guardarDevuelveLoRecibido();
        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1));
        dto.setEstadoPago(EstadoPago.COMPLETADO);
        dto.setPagoId("pi_inventado12345678");

        Pedido pedido = servicio.crearPedidoSeguro(dto, null);

        assertEquals(EstadoPago.PENDIENTE, pedido.getEstadoPago());
        assertNull(pedido.getPagoId());
        verifyNoInteractions(verificacionPago);
    }

    @Test
    void elTotalDeUnCarritoSaleDeLosPreciosDeLaCartaYNoSeGuardaNada() {
        // Long y no long: con el primitivo se elige el findById(long) del repositorio, que no devuelve Optional
        Long croquetas = 10L;
        Long agua = 11L;
        when(productoRepository.findById(croquetas)).thenReturn(Optional.of(producto(croquetas, 2.5)));
        when(productoRepository.findById(agua)).thenReturn(Optional.of(producto(agua, 1.2)));

        BigDecimal total = servicio.totalDe(List.of(linea(croquetas, 2), linea(agua, 3)));

        assertEquals(0, new BigDecimal("8.60").compareTo(total));
        verifyNoInteractions(pedidoRepository);
        assertThrows(IllegalArgumentException.class, () -> servicio.totalDe(List.of()));
    }

    @Test
    void pedidoADomicilioGuardaDireccionYTelefonoSinMesa() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 4.0)));
        guardarDevuelveLoRecibido();

        PedidoDto dto = pedidoDto(TipoPedido.DOMICILIO, "efectivo", linea(productoId, 1));
        dto.setDireccionEnvio("Calle Mayor 1");
        dto.setTelefonoContacto("600000000");

        Pedido pedido = servicio.crearPedidoSeguro(dto, null);

        assertEquals("Calle Mayor 1", pedido.getDireccionEnvio());
        assertEquals("600000000", pedido.getTelefonoContacto());
        assertNull(pedido.getMesa());
    }

    @Test
    void pedidoParaRecogerNoGuardaDireccion() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 4.0)));
        guardarDevuelveLoRecibido();

        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1));
        dto.setDireccionEnvio("No debe guardarse");
        dto.setTelefonoContacto("600000000");

        Pedido pedido = servicio.crearPedidoSeguro(dto, null);

        assertNull(pedido.getDireccionEnvio());
        assertEquals("600000000", pedido.getTelefonoContacto());
        assertNull(pedido.getMesa());
    }

    @Test
    void pedidoEnMesaSinMesaFalla() {
        PedidoDto dto = pedidoDto(TipoPedido.MESA, "efectivo", linea(10L, 1));

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(dto, null));
        verify(pedidoRepository, never()).save(any(Pedido.class));
    }

    @Test
    void pedidoEnMesaInexistenteFalla() {
        Long mesaId = 99L;
        when(mesaRepository.findById(mesaId)).thenReturn(Optional.empty());
        PedidoDto dto = pedidoDto(TipoPedido.MESA, "efectivo", linea(10L, 1));
        dto.setIdMesa(mesaId);

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(dto, null));
    }

    @Test
    void pedidoSinTipoFalla() {
        PedidoDto dto = pedidoDto(null, "efectivo", linea(10L, 1));

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(dto, null));
    }

    @Test
    void pedidoSinLineasFalla() {
        PedidoDto vacio = pedidoDto(TipoPedido.RECOGER, "efectivo");
        PedidoDto nulo = pedidoDto(TipoPedido.RECOGER, "efectivo");
        nulo.setDetalles(null);

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(vacio, null));
        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(nulo, null));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, 51})
    void cantidadFueraDeRangoFalla(int cantidad) {
        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(10L, cantidad));

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(dto, null));
    }

    @Test
    void lineaSinProductoOSinCantidadFalla() {
        PedidoDto sinProducto = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(null, 1));
        PedidoDto sinCantidad = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(10L, null));

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(sinProducto, null));
        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(sinCantidad, null));
    }

    @Test
    void productoInexistenteFalla() {
        Long productoId = 77L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.empty());
        PedidoDto dto = pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1));

        assertThrows(IllegalArgumentException.class, () -> servicio.crearPedidoSeguro(dto, null));
    }

    @Test
    void usuarioAnonimoCreaPedidoSinUsuario() {
        Long productoId = 10L;
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.0)));
        guardarDevuelveLoRecibido();

        Pedido pedido = servicio.crearPedidoSeguro(
                pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1)), "anonymousUser");

        assertNull(pedido.getUser());
        verifyNoInteractions(userRepository);
    }

    @Test
    void pedidoSeAsociaAlUsuarioIndicado() {
        Long productoId = 10L;
        User usuario = new User();
        when(userRepository.findByUsername("juan")).thenReturn(Optional.of(usuario));
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.0)));
        guardarDevuelveLoRecibido();

        Pedido pedido = servicio.crearPedidoSeguro(
                pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1)), "juan");

        assertSame(usuario, pedido.getUser());
    }

    @Test
    void sinNombreUsaElUsuarioAutenticado() {
        Long productoId = 10L;
        User usuario = new User();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("maria", null, List.of()));
        when(userRepository.findByUsername("maria")).thenReturn(Optional.of(usuario));
        when(productoRepository.findById(productoId)).thenReturn(Optional.of(producto(productoId, 1.0)));
        guardarDevuelveLoRecibido();

        Pedido pedido = servicio.crearPedidoSeguro(
                pedidoDto(TipoPedido.RECOGER, "efectivo", linea(productoId, 1)), null);

        assertSame(usuario, pedido.getUser());
    }

    // ---------- consultas ----------

    @Test
    void buscarPorUsernameInexistenteFalla() {
        when(userRepository.findByUsername("nadie")).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> servicio.findByUsername("nadie"));
    }

    @Test
    void buscarPorUsernameDevuelveSusPedidos() {
        User usuario = new User();
        usuario.setId(4L);
        List<Pedido> pedidos = List.of(new Pedido());
        when(userRepository.findByUsername("juan")).thenReturn(Optional.of(usuario));
        when(pedidoRepository.findByUsuarioIdWithDetalles(4L)).thenReturn(pedidos);

        assertSame(pedidos, servicio.findByUsername("juan"));
    }

    @Test
    void pendientesEnEfectivoUsaElFiltroDeEfectivoPendiente() {
        List<Pedido> pedidos = List.of(new Pedido());
        when(pedidoRepository.findByMetodoPagoIgnoreCaseAndEstadoPago("efectivo", EstadoPago.PENDIENTE))
                .thenReturn(pedidos);

        assertSame(pedidos, servicio.findPedidosPendientesEfectivo());
    }

    // ---------- borrar y actualizar ----------

    @Test
    void borrarPedidoExistenteLoElimina() {
        Pedido pedido = new Pedido();
        when(pedidoRepository.findById(5L)).thenReturn(pedido);

        servicio.delete(5L);

        verify(pedidoRepository).delete(pedido);
    }

    @Test
    void borrarPedidoInexistenteNoHaceNada() {
        when(pedidoRepository.findById(5L)).thenReturn(null);

        servicio.delete(5L);

        verify(pedidoRepository, never()).delete(any(Pedido.class));
    }

    @Test
    void actualizarPedidoInexistenteDevuelveNulo() {
        when(pedidoRepository.findById(5L)).thenReturn(null);

        assertNull(servicio.update(5L, new Pedido()));
        assertNull(servicio.updateFromDto(5L, new PedidoDto()));
    }

    @Test
    void actualizarCopiaLosCamposDelPedido() {
        Pedido existente = new Pedido();
        Pedido nuevo = new Pedido();
        LocalDateTime fecha = LocalDateTime.of(2026, 11, 16, 20, 0);
        nuevo.setFecha(fecha);
        nuevo.setEstado(EstadoPedido.PENDIENTE);
        nuevo.setPrecioTotal(new BigDecimal("12.50"));
        when(pedidoRepository.findById(5L)).thenReturn(existente);
        guardarDevuelveLoRecibido();

        Pedido resultado = servicio.update(5L, nuevo);

        assertEquals(fecha, resultado.getFecha());
        assertEquals(EstadoPedido.PENDIENTE, resultado.getEstado());
        assertEquals(0, new BigDecimal("12.50").compareTo(resultado.getPrecioTotal()));
    }

    @Test
    void actualizarConUsuarioInexistenteFalla() {
        Long idUsuario = 2L;
        Pedido nuevo = new Pedido();
        User referencia = new User();
        referencia.setId(idUsuario);
        nuevo.setUser(referencia);
        when(pedidoRepository.findById(5L)).thenReturn(new Pedido());
        when(userRepository.findById(idUsuario)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> servicio.update(5L, nuevo));
    }

    @Test
    void actualizarDesdeDtoSoloCambiaLosCamposRecibidos() {
        Pedido existente = new Pedido();
        existente.setEstado(EstadoPedido.PENDIENTE);
        existente.setTelefonoContacto("111");
        existente.setDireccionEnvio("Calle Vieja");
        when(pedidoRepository.findById(5L)).thenReturn(existente);
        guardarDevuelveLoRecibido();

        PedidoDto dto = new PedidoDto();
        dto.setTelefonoContacto("222");

        Pedido resultado = servicio.updateFromDto(5L, dto);

        assertNotNull(resultado);
        assertEquals("222", resultado.getTelefonoContacto());
        assertEquals("Calle Vieja", resultado.getDireccionEnvio());
        assertEquals(EstadoPedido.PENDIENTE, resultado.getEstado());
        assertNotEquals("111", resultado.getTelefonoContacto());
    }
}
