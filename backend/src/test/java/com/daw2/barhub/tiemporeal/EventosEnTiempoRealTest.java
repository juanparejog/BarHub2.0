package com.daw2.barhub.tiemporeal;

import com.daw2.barhub.auth.sesion.SesionService;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/** Al parar la aplicacion: se cierran las conexiones y el latido ya no consulta la base de datos. */
class EventosEnTiempoRealTest {

    @Test
    void alPararSeCierranLasConexionesYElLatidoNoMiraLasSesiones() {
        SesionService sesiones = mock(SesionService.class);
        EventosEnTiempoReal eventos = new EventosEnTiempoReal(sesiones, Duration.ofMinutes(5), 500);
        eventos.suscribir(EventosEnTiempoReal.Canal.PERSONAL, 1L, "sesion-1");
        eventos.suscribir(EventosEnTiempoReal.Canal.CLIENTE, 2L, "sesion-2");
        assertEquals(2, eventos.abiertas());

        eventos.alParar();
        eventos.latido();

        assertEquals(0, eventos.abiertas());
        // Con el contexto cerrandose, la tabla de sesiones puede no existir ya (H2 en los tests)
        verifyNoInteractions(sesiones);
    }
}
