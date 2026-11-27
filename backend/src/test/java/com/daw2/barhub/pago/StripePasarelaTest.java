package com.daw2.barhub.pago;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Que claves activan el pago con tarjeta. No llama a Stripe. */
class StripePasarelaTest {

    private static final String SECRETA_PRUEBAS = "sk_test_51Abcdefghij";
    private static final String PUBLICA_PRUEBAS = "pk_test_51Abcdefghij";

    @Test
    void conLasDosClavesDePruebasQuedaActivoEnModoDePruebas() {
        StripePasarela pasarela = new StripePasarela(SECRETA_PRUEBAS, PUBLICA_PRUEBAS, true);
        assertTrue(pasarela.disponible());
        assertTrue(pasarela.enPruebas());
        assertEquals(PUBLICA_PRUEBAS, pasarela.clavePublica());
    }

    @Test
    void sinClavesOConValoresDeEjemploQuedaDesactivadoYNoEnsenaNada() {
        StripePasarela sinClaves = new StripePasarela("", "", true);
        assertFalse(sinClaves.disponible());
        assertNull(sinClaves.clavePublica());
        // El valor de ejemplo del .env.example antiguo
        assertFalse(new StripePasarela("stripe_sk", PUBLICA_PRUEBAS, true).disponible());
        assertFalse(new StripePasarela(SECRETA_PRUEBAS, "", true).disponible());
        assertFalse(new StripePasarela(SECRETA_PRUEBAS, "sk_test_al_reves", true).disponible());
    }

    @Test
    void lasClavesRealesSoloValenSiSeQuitaElModoDePruebas() {
        assertNotNull(StripePasarela.motivoNoDisponible("sk_live_51Abc", "pk_live_51Abc", true));
        assertNull(StripePasarela.motivoNoDisponible("sk_live_51Abc", "pk_live_51Abc", false));
        // Mezclar una de pruebas con una real no vale nunca
        assertNotNull(StripePasarela.motivoNoDisponible(SECRETA_PRUEBAS, "pk_live_51Abc", false));
        assertNotNull(StripePasarela.motivoNoDisponible("sk_live_51Abc", PUBLICA_PRUEBAS, false));
        // Clave restringida de pruebas
        assertNull(StripePasarela.motivoNoDisponible("rk_test_51Abc", PUBLICA_PRUEBAS, true));
    }
}
