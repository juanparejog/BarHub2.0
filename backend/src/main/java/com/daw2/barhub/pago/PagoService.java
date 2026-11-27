package com.daw2.barhub.pago;

import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.service.PedidoService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/** Lo que pide el navegador antes de crear un pedido con tarjeta: la configuracion y el intento de pago. */
@Service
public class PagoService {

    private final PasarelaPago pasarela;
    private final PedidoService pedidoService;

    public PagoService(PasarelaPago pasarela, PedidoService pedidoService) {
        this.pasarela = pasarela;
        this.pedidoService = pedidoService;
    }

    /** Lo que necesita el navegador: si hay tarjeta, la clave publicable y si es el modo de pruebas. */
    public record Configuracion(boolean tarjeta, String clavePublica, boolean pruebas) {
    }

    /** El intento de pago: su id, el secreto con el que Stripe.js lo confirma y el importe en euros. */
    public record Intento(String id, String clientSecret, BigDecimal importe) {
    }

    public Configuracion configuracion() {
        return new Configuracion(pasarela.disponible(), pasarela.clavePublica(), pasarela.enPruebas());
    }

    /**
     * Crea el intento de pago por el importe que calcula el servidor con los precios de la carta (los
     * que mande el navegador no cuentan) y lo ata al usuario y a esos productos.
     */
    public Intento crearIntento(List<DetallePedidoDto> detalles, Long usuarioId) {
        if (!pasarela.disponible()) {
            throw new PagoRechazadoException(HttpStatus.SERVICE_UNAVAILABLE,
                    "El pago con tarjeta no está disponible. Puedes pagar en efectivo.");
        }
        BigDecimal total = pedidoService.totalDe(detalles);
        PasarelaPago.Intento intento = pasarela.crear(VerificacionPago.centimos(total), VerificacionPago.MONEDA,
                VerificacionPago.metadatos(detalles, usuarioId), "Pedido de BarHub");
        return new Intento(intento.id(), intento.secretoCliente(), total);
    }
}
