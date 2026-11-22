package com.daw2.barhub.auth.dosfactores;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.OptionalLong;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Vectores de prueba de las RFC 6238 (TOTP) y 4648 (Base32). */
class TotpTest {

    /** Secreto de los vectores de la RFC 6238 para SHA-1. */
    private static final byte[] SECRETO_RFC = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    private static String codigoEn(long segundos) {
        return Totp.codigo(SECRETO_RFC, Totp.paso(Instant.ofEpochSecond(segundos)));
    }

    @Test
    void coincideConLosVectoresDeLaRfc6238() {
        // la RFC da 8 digitos; con 6 son los 6 ultimos
        assertEquals("287082", codigoEn(59L));
        assertEquals("081804", codigoEn(1_111_111_109L));
        assertEquals("050471", codigoEn(1_111_111_111L));
        assertEquals("005924", codigoEn(1_234_567_890L));
        assertEquals("279037", codigoEn(2_000_000_000L));
        assertEquals("353130", codigoEn(20_000_000_000L));
    }

    @Test
    void aceptaUnPasoDeMargenACadaLadoYNoMas() {
        Instant ahora = Instant.ofEpochSecond(1_234_567_890L);
        long paso = Totp.paso(ahora);

        assertEquals(OptionalLong.of(paso - 1), Totp.verificar(SECRETO_RFC, Totp.codigo(SECRETO_RFC, paso - 1), ahora, null));
        assertEquals(OptionalLong.of(paso), Totp.verificar(SECRETO_RFC, Totp.codigo(SECRETO_RFC, paso), ahora, null));
        assertEquals(OptionalLong.of(paso + 1), Totp.verificar(SECRETO_RFC, Totp.codigo(SECRETO_RFC, paso + 1), ahora, null));
        assertTrue(Totp.verificar(SECRETO_RFC, Totp.codigo(SECRETO_RFC, paso - 2), ahora, null).isEmpty());
        assertTrue(Totp.verificar(SECRETO_RFC, Totp.codigo(SECRETO_RFC, paso + 2), ahora, null).isEmpty());
    }

    @Test
    void unCodigoDeUnPasoYaUsadoNoVale() {
        Instant ahora = Instant.ofEpochSecond(1_234_567_890L);
        long paso = Totp.paso(ahora);
        String codigo = Totp.codigo(SECRETO_RFC, paso);

        assertTrue(Totp.verificar(SECRETO_RFC, codigo, ahora, paso).isEmpty());
        // ni uno anterior al ultimo usado, aunque este dentro del margen
        assertTrue(Totp.verificar(SECRETO_RFC, Totp.codigo(SECRETO_RFC, paso - 1), ahora, paso).isEmpty());
        assertEquals(OptionalLong.of(paso), Totp.verificar(SECRETO_RFC, codigo, ahora, paso - 1));
    }

    @Test
    void rechazaLoQueNoSonSeisDigitos() {
        Instant ahora = Instant.ofEpochSecond(59L);
        assertTrue(Totp.verificar(SECRETO_RFC, null, ahora, null).isEmpty());
        assertTrue(Totp.verificar(SECRETO_RFC, "", ahora, null).isEmpty());
        assertTrue(Totp.verificar(SECRETO_RFC, "28708", ahora, null).isEmpty());
        assertTrue(Totp.verificar(SECRETO_RFC, "94287082", ahora, null).isEmpty());
        assertTrue(Totp.verificar(SECRETO_RFC, "28708a", ahora, null).isEmpty());
    }

    @Test
    void laUriLlevaEmisorCuentaYParametros() {
        assertEquals("otpauth://totp/BarHub:ana%20l%C3%B3pez?secret=JBSWY3DPEHPK3PXP&issuer=BarHub"
                        + "&algorithm=SHA1&digits=6&period=30",
                Totp.uri("BarHub", "ana lópez", "JBSWY3DPEHPK3PXP"));
    }

    @Test
    void base32CoincideConLosVectoresDeLaRfc4648() {
        String[][] vectores = {{"", ""}, {"f", "MY"}, {"fo", "MZXQ"}, {"foo", "MZXW6"}, {"foob", "MZXW6YQ"},
                {"fooba", "MZXW6YTB"}, {"foobar", "MZXW6YTBOI"}};
        for (String[] v : vectores) {
            byte[] datos = v[0].getBytes(StandardCharsets.US_ASCII);
            assertEquals(v[1], Base32.codificar(datos));
            assertArrayEquals(datos, Base32.decodificar(v[1]));
        }
        // como lo escribiria alguien a mano: minusculas, espacios y relleno
        assertArrayEquals("foobar".getBytes(StandardCharsets.US_ASCII), Base32.decodificar("mzxw 6ytb oi======"));
        assertThrows(IllegalArgumentException.class, () -> Base32.decodificar("MZXW1"));
    }
}
