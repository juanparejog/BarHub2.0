package com.daw2.barhub.auth.dosfactores;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.OptionalLong;

/**
 * Codigos de un solo uso basados en el tiempo (TOTP, RFC 6238) con los parametros que entienden
 * todas las apps de autenticacion: HMAC-SHA1, pasos de 30 segundos y 6 digitos.
 *
 * <p>Se acepta un paso de margen a cada lado (un codigo vale como mucho 90 segundos) por si el
 * reloj del movil no va exacto. Un codigo de un paso ya usado no se acepta otra vez: quien lo vea
 * por encima del hombro no puede reutilizarlo.
 */
public final class Totp {

    public static final int PERIODO_SEGUNDOS = 30;
    public static final int DIGITOS = 6;
    public static final int MARGEN_PASOS = 1;
    private static final int MODULO = 1_000_000;
    private static final String ALGORITMO = "HmacSHA1";

    private Totp() {
    }

    /** Numero de paso de 30 segundos (contador T de la RFC 6238). */
    public static long paso(Instant instante) {
        return Math.floorDiv(instante.getEpochSecond(), PERIODO_SEGUNDOS);
    }

    /** Codigo de 6 digitos de un paso, con ceros a la izquierda. */
    public static String codigo(byte[] secreto, long paso) {
        byte[] hash;
        try {
            Mac mac = Mac.getInstance(ALGORITMO);
            mac.init(new SecretKeySpec(secreto, ALGORITMO));
            hash = mac.doFinal(ByteBuffer.allocate(Long.BYTES).putLong(paso).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA1 no disponible", e);
        }
        // truncado dinamico (RFC 4226, seccion 5.3)
        int inicio = hash[hash.length - 1] & 0x0f;
        int binario = ((hash[inicio] & 0x7f) << 24)
                | ((hash[inicio + 1] & 0xff) << 16)
                | ((hash[inicio + 2] & 0xff) << 8)
                | (hash[inicio + 3] & 0xff);
        return String.format("%0" + DIGITOS + "d", binario % MODULO);
    }

    /**
     * Paso al que corresponde {@code codigo} si es valido ahora (con el margen) y posterior a
     * {@code ultimoPasoUsado}; vacio si no.
     */
    public static OptionalLong verificar(byte[] secreto, String codigo, Instant ahora, Long ultimoPasoUsado) {
        if (codigo == null || !codigo.matches("\\d{" + DIGITOS + "}")) {
            return OptionalLong.empty();
        }
        byte[] recibido = codigo.getBytes(StandardCharsets.US_ASCII);
        long actual = paso(ahora);
        for (long p = actual - MARGEN_PASOS; p <= actual + MARGEN_PASOS; p++) {
            if (ultimoPasoUsado != null && p <= ultimoPasoUsado) {
                continue;
            }
            // comparacion en tiempo constante
            if (MessageDigest.isEqual(codigo(secreto, p).getBytes(StandardCharsets.US_ASCII), recibido)) {
                return OptionalLong.of(p);
            }
        }
        return OptionalLong.empty();
    }

    /** URI {@code otpauth://} que se muestra como codigo QR para dar de alta la cuenta en la app. */
    public static String uri(String emisor, String cuenta, String secretoBase32) {
        String etiqueta = codificar(emisor) + ":" + codificar(cuenta);
        return "otpauth://totp/" + etiqueta
                + "?secret=" + secretoBase32
                + "&issuer=" + codificar(emisor)
                + "&algorithm=SHA1&digits=" + DIGITOS + "&period=" + PERIODO_SEGUNDOS;
    }

    private static String codificar(String texto) {
        return URLEncoder.encode(texto, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
