package com.daw2.barhub.pago;

import java.util.Map;
import java.util.Optional;

/**
 * Lo que BarHub necesita de la pasarela de pago (Stripe). Separado de Stripe para que el resto del
 * codigo y los tests no dependan de la red ni de las claves.
 */
public interface PasarelaPago {

    /** Si hay claves validas para cobrar con tarjeta. */
    boolean disponible();

    /** Clave publicable para Stripe.js; null si no esta disponible. */
    String clavePublica();

    /** Si las claves son de pruebas (no se cobra dinero real). */
    boolean enPruebas();

    /** Crea el intento de pago por ese importe; el navegador lo confirma con la tarjeta. */
    Intento crear(long centimos, String moneda, Map<String, String> metadatos, String descripcion);

    /** El pago tal como lo tiene la pasarela; vacio si no existe. */
    Optional<Consulta> consultar(String id);

    /** Devuelve el importe entero de un pago ya cobrado. */
    void devolver(String id);

    record Intento(String id, String secretoCliente) {
    }

    record Consulta(String id, String estado, long centimos, String moneda, Map<String, String> metadatos) {
    }
}
