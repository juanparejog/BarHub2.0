package com.daw2.barhub.pago;

import com.stripe.exception.InvalidRequestException;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

/**
 * Pasarela de pago con Stripe (PaymentIntents). La clave secreta solo vive en el servidor y va en
 * cada peticion (no en la variable global de la libreria). Con {@code app.pagos.solo-pruebas=true}
 * (por defecto) solo acepta claves de pruebas: con unas reales, el pago con tarjeta queda desactivado.
 */
@Slf4j
@Component
public class StripePasarela implements PasarelaPago {

    private final String claveSecreta;
    private final String clavePublica;
    private final boolean disponible;

    public StripePasarela(@Value("${app.pagos.stripe.clave-secreta:}") String claveSecreta,
                          @Value("${app.pagos.stripe.clave-publica:}") String clavePublica,
                          @Value("${app.pagos.solo-pruebas:true}") boolean soloPruebas) {
        this.claveSecreta = claveSecreta == null ? "" : claveSecreta.strip();
        this.clavePublica = clavePublica == null ? "" : clavePublica.strip();
        String motivo = motivoNoDisponible(this.claveSecreta, this.clavePublica, soloPruebas);
        this.disponible = motivo == null;
        if (disponible) {
            log.info("Pago con tarjeta activado con Stripe ({})", enPruebas() ? "modo de pruebas" : "modo real");
        } else if (this.claveSecreta.isEmpty() && this.clavePublica.isEmpty()) {
            log.info("Pago con tarjeta desactivado: sin claves de Stripe (STRIPE_SECRET_KEY y STRIPE_PUBLISHABLE_KEY)");
        } else {
            log.warn("Pago con tarjeta desactivado: {}", motivo);
        }
    }

    /** Por que no se puede cobrar con estas claves, o null si se puede. */
    static String motivoNoDisponible(String secreta, String publica, boolean soloPruebas) {
        if (secreta.isEmpty() || publica.isEmpty()) {
            return "faltan STRIPE_SECRET_KEY o STRIPE_PUBLISHABLE_KEY";
        }
        if (!secreta.startsWith("sk_") && !secreta.startsWith("rk_")) {
            return "STRIPE_SECRET_KEY no es una clave secreta de Stripe (sk_... o rk_...)";
        }
        if (!publica.startsWith("pk_")) {
            return "STRIPE_PUBLISHABLE_KEY no es una clave publicable de Stripe (pk_...)";
        }
        boolean secretaDePruebas = secreta.contains("_test_");
        if (secretaDePruebas != publica.contains("_test_")) {
            return "una clave es de pruebas y la otra no";
        }
        if (soloPruebas && !secretaDePruebas) {
            return "las claves son reales y app.pagos.solo-pruebas=true (solo se admite el modo de pruebas)";
        }
        return null;
    }

    @Override
    public boolean disponible() {
        return disponible;
    }

    @Override
    public String clavePublica() {
        return disponible ? clavePublica : null;
    }

    @Override
    public boolean enPruebas() {
        return !disponible || claveSecreta.contains("_test_");
    }

    @Override
    public Intento crear(long centimos, String moneda, Map<String, String> metadatos, String descripcion) {
        PaymentIntentCreateParams parametros = PaymentIntentCreateParams.builder()
                .setAmount(centimos)
                .setCurrency(moneda)
                // Sin payment_method_types: Stripe usa los metodos de pago activos de la cuenta (la tarjeta lo
                // esta siempre) y el frontend confirma el pago con la tarjeta (Card Element)
                .putAllMetadata(metadatos)
                .setDescription(descripcion)
                .build();
        try {
            PaymentIntent intento = PaymentIntent.create(parametros, opciones());
            return new Intento(intento.getId(), intento.getClientSecret());
        } catch (StripeException e) {
            log.warn("Stripe no ha creado el intento de pago ({}): {}", e.getCode(), e.getMessage());
            throw new PagoRechazadoException(HttpStatus.BAD_GATEWAY, "No se pudo preparar el pago con tarjeta. Inténtalo de nuevo.");
        }
    }

    @Override
    public Optional<Consulta> consultar(String id) {
        try {
            PaymentIntent pago = PaymentIntent.retrieve(id, opciones());
            return Optional.of(new Consulta(pago.getId(), pago.getStatus(),
                    pago.getAmount() == null ? 0 : pago.getAmount(), pago.getCurrency(),
                    pago.getMetadata() == null ? Map.of() : pago.getMetadata()));
        } catch (InvalidRequestException e) {
            if ("resource_missing".equals(e.getCode())) {
                return Optional.empty();
            }
            log.warn("Stripe rechaza la consulta del pago: {}", e.getMessage());
            throw new PagoRechazadoException(HttpStatus.BAD_REQUEST, "El pago con tarjeta no es válido.");
        } catch (StripeException e) {
            log.warn("No se pudo consultar el pago en Stripe: {}", e.getMessage());
            throw new PagoRechazadoException(HttpStatus.BAD_GATEWAY, "No se pudo comprobar el pago con tarjeta. Inténtalo de nuevo.");
        }
    }

    @Override
    public void devolver(String id) {
        try {
            Refund.create(RefundCreateParams.builder().setPaymentIntent(id).build(), opciones());
            log.info("Pago {} devuelto", id);
        } catch (StripeException e) {
            // Cobrado y sin pedido: hay que devolverlo a mano desde el panel de Stripe
            log.error("No se pudo devolver el pago {}: {}", id, e.getMessage());
        }
    }

    private RequestOptions opciones() {
        return RequestOptions.builder().setApiKey(claveSecreta).build();
    }
}
