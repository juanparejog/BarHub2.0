package com.daw2.barhub.auth.sesion;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SesionPropertiesTest {

    private final SesionProperties porDefecto = new SesionProperties(null, null, null);

    @Test
    void cadaRolTieneSusLimites() {
        assertEquals(new SesionProperties.Limite(Duration.ofMinutes(15), Duration.ofHours(8)),
                porDefecto.limitePara(List.of("ROLE_ADMIN")));
        assertEquals(new SesionProperties.Limite(Duration.ofMinutes(30), Duration.ofHours(10)),
                porDefecto.limitePara(List.of("ROLE_EMPLEADO")));
        assertEquals(new SesionProperties.Limite(Duration.ofHours(1), Duration.ofHours(12)),
                porDefecto.limitePara(List.of("ROLE_CLIENTE")));
    }

    @Test
    void conVariosRolesSeAplicaElLimiteMasEstrictoDeCadaTipo() {
        SesionProperties propiedades = new SesionProperties(null, null, Map.of(
                "admin", new SesionProperties.Limite(Duration.ofMinutes(15), Duration.ofHours(12)),
                "empleado", new SesionProperties.Limite(Duration.ofMinutes(30), Duration.ofHours(8))));

        assertEquals(new SesionProperties.Limite(Duration.ofMinutes(15), Duration.ofHours(8)),
                propiedades.limitePara(List.of("ROLE_EMPLEADO", "ROLE_ADMIN")));
    }

    @Test
    void unRolSinLimiteConfiguradoRecibeElDeReserva() {
        assertEquals(SesionProperties.LIMITE_POR_DEFECTO, porDefecto.limitePara(List.of("ROLE_DESCONOCIDO")));
        assertEquals(SesionProperties.LIMITE_POR_DEFECTO, porDefecto.limitePara(List.of()));
    }

    @Test
    void laCookieSeguraYSoloParaLaRutaDeAutenticacionPorDefecto() {
        assertEquals("barhub_refresh", porDefecto.cookie().nombre());
        assertEquals("/api/auth", porDefecto.cookie().ruta());
        assertEquals(Boolean.TRUE, porDefecto.cookie().segura());
        assertEquals(Duration.ofSeconds(30), porDefecto.graciaRotacion());
    }
}
