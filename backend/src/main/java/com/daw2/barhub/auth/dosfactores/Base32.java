package com.daw2.barhub.auth.dosfactores;

import java.io.ByteArrayOutputStream;
import java.util.Locale;

/**
 * Base32 de la RFC 4648, el formato en que las apps de autenticacion esperan la clave TOTP
 * (Google Authenticator, Microsoft Authenticator, Aegis...). Se codifica sin el relleno {@code =};
 * al decodificar se aceptan minusculas, espacios y relleno.
 */
public final class Base32 {

    private static final String ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private Base32() {
    }

    public static String codificar(byte[] datos) {
        StringBuilder resultado = new StringBuilder((datos.length * 8 + 4) / 5);
        int bufer = 0;
        int bits = 0;
        for (byte b : datos) {
            bufer = (bufer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                resultado.append(ALFABETO.charAt((bufer >> (bits - 5)) & 0x1f));
                bits -= 5;
            }
        }
        if (bits > 0) {
            resultado.append(ALFABETO.charAt((bufer << (5 - bits)) & 0x1f));
        }
        return resultado.toString();
    }

    public static byte[] decodificar(String texto) {
        String limpio = texto.replaceAll("[\\s=]", "").toUpperCase(Locale.ROOT);
        ByteArrayOutputStream resultado = new ByteArrayOutputStream(limpio.length() * 5 / 8);
        int bufer = 0;
        int bits = 0;
        for (char c : limpio.toCharArray()) {
            int valor = ALFABETO.indexOf(c);
            if (valor < 0) {
                throw new IllegalArgumentException("Caracter no valido en Base32: " + c);
            }
            bufer = (bufer << 5) | valor;
            bits += 5;
            if (bits >= 8) {
                resultado.write((bufer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return resultado.toByteArray();
    }
}
