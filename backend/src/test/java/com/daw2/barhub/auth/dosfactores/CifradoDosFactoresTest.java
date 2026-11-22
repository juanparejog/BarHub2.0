package com.daw2.barhub.auth.dosfactores;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CifradoDosFactoresTest {

    private static final String JWT = "clave-jwt-de-pruebas-0123456789-abcdefghij";
    private static final byte[] SECRETO = "secreto-totp-de-20-b".getBytes(StandardCharsets.US_ASCII);

    private static CifradoDosFactores conClave(String clave) {
        return new CifradoDosFactores(new DosFactoresProperties(null, null, clave), JWT);
    }

    @Test
    void cifraYDescifraElSecretoDeCadaUsuario() {
        CifradoDosFactores cifrado = conClave("clave-maestra-de-pruebas");
        String guardado = cifrado.cifrar(7L, SECRETO);

        assertTrue(guardado.startsWith("v1:"));
        assertFalse(guardado.contains("secreto"));
        assertArrayEquals(SECRETO, cifrado.descifrar(7L, guardado));
        // IV aleatorio: el mismo secreto no da dos veces el mismo texto cifrado
        assertNotEquals(guardado, cifrado.cifrar(7L, SECRETO));
    }

    @Test
    void elSecretoDeUnUsuarioNoSirveEnLaFilaDeOtro() {
        CifradoDosFactores cifrado = conClave("clave-maestra-de-pruebas");
        String guardado = cifrado.cifrar(7L, SECRETO);

        assertThrows(IllegalStateException.class, () -> cifrado.descifrar(8L, guardado));
    }

    @Test
    void conOtraClaveNoSeDescifraYUnTextoAlteradoTampoco() {
        String guardado = conClave("clave-maestra-de-pruebas").cifrar(7L, SECRETO);

        assertThrows(IllegalStateException.class, () -> conClave("otra-clave").descifrar(7L, guardado));
        char ultimo = guardado.charAt(guardado.length() - 2);
        String alterado = guardado.substring(0, guardado.length() - 2) + (ultimo == 'A' ? 'B' : 'A') + guardado.charAt(guardado.length() - 1);
        assertThrows(IllegalStateException.class, () -> conClave("clave-maestra-de-pruebas").descifrar(7L, alterado));
        assertThrows(IllegalStateException.class, () -> conClave("clave-maestra-de-pruebas").descifrar(7L, "texto-sin-formato"));
    }

    @Test
    void sinClavePropiaSeDerivaDelSecretoJwt() {
        CifradoDosFactores sinClave = conClave("");
        CifradoDosFactores conLaDelJwt = conClave(JWT);

        assertArrayEquals(SECRETO, conLaDelJwt.descifrar(1L, sinClave.cifrar(1L, SECRETO)));
        assertThrows(IllegalStateException.class,
                () -> new CifradoDosFactores(new DosFactoresProperties(null, null, null), ""));
    }

    @Test
    void laHuellaDeUnCodigoEsFijaYDependeDeLaClave() {
        CifradoDosFactores cifrado = conClave("clave-maestra-de-pruebas");

        assertEquals(cifrado.huella("ABCDE23456"), cifrado.huella("ABCDE23456"));
        assertEquals(64, cifrado.huella("ABCDE23456").length());
        assertNotEquals(cifrado.huella("ABCDE23456"), cifrado.huella("ABCDE23457"));
        assertNotEquals(cifrado.huella("ABCDE23456"), conClave("otra-clave").huella("ABCDE23456"));
    }

    @Test
    void losRolesObligatoriosSeLeenConOSinPrefijo() {
        DosFactoresProperties porDefecto = new DosFactoresProperties(null, null, null);
        assertTrue(porDefecto.obligatorioPara(java.util.List.of("ROLE_ADMIN")));
        assertTrue(porDefecto.obligatorioPara(java.util.List.of("ROLE_CLIENTE", "ROLE_EMPLEADO")));
        assertFalse(porDefecto.obligatorioPara(java.util.List.of("ROLE_CLIENTE")));
        assertEquals("BarHub", porDefecto.emisor());

        DosFactoresProperties nadie = new DosFactoresProperties(java.util.List.of(""), "Bar", null);
        assertFalse(nadie.obligatorioPara(java.util.List.of("ROLE_ADMIN")));
        assertTrue(new DosFactoresProperties(java.util.List.of(" Admin "), null, null).obligatorioPara(java.util.List.of("ROLE_ADMIN")));
    }
}
