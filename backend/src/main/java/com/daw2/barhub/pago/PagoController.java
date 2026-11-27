package com.daw2.barhub.pago;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.dto.ErrorDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Pago con tarjeta. El flujo: el navegador pide un intento de pago con los productos, lo confirma con
 * Stripe.js (los datos de la tarjeta van directos a Stripe, nunca a BarHub) y crea el pedido con el id
 * del pago, que el servidor comprueba en Stripe antes de darlo por pagado (ver VerificacionPago).
 */
@Slf4j
@RestController
@RequestMapping("/pagos")
public class PagoController {

    private final PagoService pagos;

    public PagoController(PagoService pagos) {
        this.pagos = pagos;
    }

    /** Los productos del carrito; el precio que pueda venir se ignora. */
    public record PeticionIntento(List<DetallePedidoDto> detalles) {
    }

    @GetMapping("/configuracion")
    public PagoService.Configuracion configuracion() {
        return pagos.configuracion();
    }

    @PostMapping("/intento")
    public ResponseEntity<?> intento(@RequestBody PeticionIntento peticion, Authentication autenticacion) {
        try {
            List<DetallePedidoDto> detalles = peticion == null || peticion.detalles() == null ? List.of() : peticion.detalles();
            return ResponseEntity.status(HttpStatus.CREATED).body(pagos.crearIntento(detalles, usuarioId(autenticacion)));
        } catch (PagoRechazadoException e) {
            return ResponseEntity.status(e.getEstado()).body(ErrorDto.from(e.getMessage()));
        } catch (IllegalArgumentException e) {
            // Mensajes de la validacion de las lineas, escritos para el cliente
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        }
    }

    static Long usuarioId(Authentication autenticacion) {
        return autenticacion != null && autenticacion.getPrincipal() instanceof UserDetailsImpl usuario ? usuario.getId() : null;
    }
}
