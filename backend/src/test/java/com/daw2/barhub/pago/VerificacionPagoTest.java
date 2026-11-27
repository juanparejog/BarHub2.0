package com.daw2.barhub.pago;

import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.repository.PedidoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Cada motivo por el que un pago con tarjeta no vale para un pedido. */
class VerificacionPagoTest {

    private static final String PAGO = "pi_3QabcdefGHIJ1234";
    private static final Long USUARIO = 7L;
    private static final BigDecimal TOTAL = new BigDecimal("12.50");

    private PasarelaPago pasarela;
    private PedidoRepository pedidos;
    private VerificacionPago verificacion;
    private List<DetallePedidoDto> carrito;

    private static DetallePedidoDto linea(long producto, int cantidad) {
        DetallePedidoDto detalle = new DetallePedidoDto();
        detalle.setIdProducto(producto);
        detalle.setCantidad(cantidad);
        return detalle;
    }

    @BeforeEach
    void preparar() {
        pasarela = mock(PasarelaPago.class);
        pedidos = mock(PedidoRepository.class);
        verificacion = new VerificacionPago(pasarela, pedidos);
        carrito = List.of(linea(1, 2), linea(4, 1));
        when(pasarela.disponible()).thenReturn(true);
    }

    private void enStripe(String estado, long centimos, String moneda, Map<String, String> metadatos) {
        when(pasarela.consultar(PAGO)).thenReturn(Optional.of(new PasarelaPago.Consulta(PAGO, estado, centimos, moneda, metadatos)));
    }

    private Map<String, String> metadatosDe(List<DetallePedidoDto> lineas, Long usuario) {
        return new HashMap<>(VerificacionPago.metadatos(lineas, usuario));
    }

    private HttpStatus rechazo(String pago) {
        return assertThrows(PagoRechazadoException.class,
                () -> verificacion.comprobar(pago, TOTAL, carrito, USUARIO)).getEstado();
    }

    @Test
    void unPagoCobradoDelUsuarioPorElTotalYParaEsosProductosVale() {
        enStripe("succeeded", 1250, "eur", metadatosDe(carrito, USUARIO));
        assertDoesNotThrow(() -> verificacion.comprobar(PAGO, TOTAL, carrito, USUARIO));
        verify(pasarela, never()).devolver(anyString());
    }

    @Test
    void sinTarjetaDisponibleOSinPagoNoSeAcepta() {
        assertEquals(HttpStatus.BAD_REQUEST, rechazo(null));
        assertEquals(HttpStatus.BAD_REQUEST, rechazo("pago-inventado"));
        assertEquals(HttpStatus.BAD_REQUEST, rechazo("pi_1;DROP TABLE"));
        when(pasarela.disponible()).thenReturn(false);
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, rechazo(PAGO));
    }

    @Test
    void unPagoQueNoExisteOQueYaTienePedidoNoVale() {
        when(pasarela.consultar(PAGO)).thenReturn(Optional.empty());
        assertEquals(HttpStatus.BAD_REQUEST, rechazo(PAGO));
        when(pedidos.existsByPagoId(PAGO)).thenReturn(true);
        assertEquals(HttpStatus.CONFLICT, rechazo(PAGO));
    }

    @Test
    void unPagoSinCobrarNoVale() {
        enStripe("requires_payment_method", 1250, "eur", metadatosDe(carrito, USUARIO));
        assertEquals(HttpStatus.PAYMENT_REQUIRED, rechazo(PAGO));
        verify(pasarela, never()).devolver(anyString());
    }

    @Test
    void elPagoDeOtroUsuarioNoValeYNoSeLeDevuelve() {
        enStripe("succeeded", 1250, "eur", metadatosDe(carrito, 99L));
        assertEquals(HttpStatus.FORBIDDEN, rechazo(PAGO));
        // Un pedido anonimo tampoco puede usar el pago de un usuario, ni al reves
        enStripe("succeeded", 1250, "eur", metadatosDe(carrito, null));
        assertEquals(HttpStatus.FORBIDDEN, rechazo(PAGO));
        verify(pasarela, never()).devolver(anyString());
    }

    @Test
    void unPagoPorOtroImporteOtraMonedaUOtrosProductosSeDevuelve() {
        enStripe("succeeded", 125, "eur", metadatosDe(carrito, USUARIO));
        assertEquals(HttpStatus.CONFLICT, rechazo(PAGO));
        enStripe("succeeded", 1250, "usd", metadatosDe(carrito, USUARIO));
        assertEquals(HttpStatus.CONFLICT, rechazo(PAGO));
        // Mismo importe, pero pagado para otros productos
        enStripe("succeeded", 1250, "eur", metadatosDe(List.of(linea(2, 5)), USUARIO));
        assertEquals(HttpStatus.CONFLICT, rechazo(PAGO));
        verify(pasarela, org.mockito.Mockito.times(3)).devolver(PAGO);
    }

    @Test
    void laHuellaDelCarritoNoDependeDelOrdenNiDeLasLineasRepetidas() {
        String huella = VerificacionPago.huella(List.of(linea(1, 2), linea(4, 1)));
        assertEquals(huella, VerificacionPago.huella(List.of(linea(4, 1), linea(1, 1), linea(1, 1))));
        assertNotEquals(huella, VerificacionPago.huella(List.of(linea(1, 3), linea(4, 1))));
        assertEquals(32, huella.length());
    }

    @Test
    void losEurosPasanACentimosSinPerderNada() {
        assertEquals(1250, VerificacionPago.centimos(new BigDecimal("12.5")));
        assertEquals(1, VerificacionPago.centimos(new BigDecimal("0.01")));
        assertEquals(1999, VerificacionPago.centimos(new BigDecimal("19.99")));
    }
}
