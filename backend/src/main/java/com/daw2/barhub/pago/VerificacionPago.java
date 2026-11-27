package com.daw2.barhub.pago;

import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.repository.PedidoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Comprueba en el servidor, preguntando a Stripe, que un pedido con tarjeta esta pagado de verdad:
 * el pago existe, esta cobrado, es de quien hace el pedido, por el importe que calcula el servidor,
 * en euros, para esos mismos productos, y no se ha usado ya en otro pedido. El navegador solo dice
 * que pago es; nunca se le cree que ha pagado.
 */
@Slf4j
@Service
public class VerificacionPago {

    public static final String MONEDA = "eur";
    static final String META_USUARIO = "barhub_usuario";
    static final String META_CARRITO = "barhub_carrito";
    static final String ANONIMO = "anonimo";
    private static final Pattern ID_DE_PAGO = Pattern.compile("pi_[A-Za-z0-9]{8,64}");

    private final PasarelaPago pasarela;
    private final PedidoRepository pedidos;

    public VerificacionPago(PasarelaPago pasarela, PedidoRepository pedidos) {
        this.pasarela = pasarela;
        this.pedidos = pedidos;
    }

    /** Lanza {@link PagoRechazadoException} si el pago no vale para este pedido. */
    public void comprobar(String pagoId, BigDecimal total, List<DetallePedidoDto> detalles, Long usuarioId) {
        if (!pasarela.disponible()) {
            throw new PagoRechazadoException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El pago con tarjeta no está disponible. Puedes pagar en efectivo.");
        }
        if (pagoId == null || !ID_DE_PAGO.matcher(pagoId).matches()) {
            throw new PagoRechazadoException(HttpStatus.BAD_REQUEST, "Falta el pago con tarjeta del pedido.");
        }
        if (pedidos.existsByPagoId(pagoId)) {
            throw new PagoRechazadoException(HttpStatus.CONFLICT,
                    "Este pago ya tiene su pedido. Puedes verlo en el seguimiento de tus pedidos.");
        }
        PasarelaPago.Consulta pago = pasarela.consultar(pagoId).orElseThrow(
                () -> new PagoRechazadoException(HttpStatus.BAD_REQUEST, "El pago con tarjeta no existe."));
        if (!usuario(usuarioId).equals(pago.metadatos().get(META_USUARIO))) {
            // No se devuelve: el pago es de otra persona y su pedido puede estar en camino
            log.warn("Pedido con un pago de otro usuario ({})", pagoId);
            throw new PagoRechazadoException(HttpStatus.FORBIDDEN, "El pago no corresponde a este pedido.");
        }
        if (!"succeeded".equals(pago.estado())) {
            throw new PagoRechazadoException(HttpStatus.PAYMENT_REQUIRED, "El pago con tarjeta no se ha completado.");
        }
        if (pago.centimos() != centimos(total) || !MONEDA.equals(pago.moneda())
                || !huella(detalles).equals(pago.metadatos().get(META_CARRITO))) {
            log.warn("El pago {} no coincide con el pedido ({} frente a {} centimos): se devuelve",
                    pagoId, pago.centimos(), centimos(total));
            pasarela.devolver(pagoId);
            throw new PagoRechazadoException(HttpStatus.CONFLICT,
                    "El pago no coincide con el pedido y se ha devuelto. Vuelve a intentarlo.");
        }
    }

    /** Los metadatos con los que se crea el intento y que luego se comprueban. */
    static Map<String, String> metadatos(List<DetallePedidoDto> detalles, Long usuarioId) {
        return Map.of(META_USUARIO, usuario(usuarioId), META_CARRITO, huella(detalles));
    }

    static long centimos(BigDecimal euros) {
        return euros.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
    }

    static String usuario(Long usuarioId) {
        return usuarioId == null ? ANONIMO : String.valueOf(usuarioId);
    }

    /**
     * Resumen de los productos y cantidades, sin importar el orden ni las lineas repetidas. Asi el
     * pago queda atado a ese carrito: no vale para otro con el mismo importe.
     */
    static String huella(List<DetallePedidoDto> detalles) {
        Map<Long, Integer> cantidades = new TreeMap<>();
        for (DetallePedidoDto detalle : detalles) {
            cantidades.merge(detalle.getIdProducto(), detalle.getCantidad(), Integer::sum);
        }
        String texto = cantidades.entrySet().stream()
                .map(e -> e.getKey() + "x" + e.getValue())
                .collect(Collectors.joining(","));
        try {
            byte[] resumen = MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(resumen, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
