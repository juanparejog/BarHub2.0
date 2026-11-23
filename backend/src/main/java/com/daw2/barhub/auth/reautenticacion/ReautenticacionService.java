package com.daw2.barhub.auth.reautenticacion;

import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.sesion.SesionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * "Modo sudo" del administrador: tras demostrar de nuevo quien es (codigo de la app, o la
 * contrasena si no usa la verificacion en dos pasos), durante {@code app.sesion.reautenticacion}
 * (5 minutos por defecto) puede hacer acciones criticas sin que se le vuelva a pedir. Iniciar
 * sesion cuenta como reautenticacion. Se guarda en la sesion del servidor, asi que un token de
 * acceso robado no la trae consigo si la ventana ya ha pasado.
 */
@Service
public class ReautenticacionService {

    public static final String CODIGO_REQUERIDA = "REAUTENTICACION_REQUERIDA";

    /** Con que tiene que confirmar: el codigo de la app si la tiene activada; si no, la contrasena. */
    public enum Metodo { CODIGO, PASSWORD }

    private final SesionService sesiones;
    private final DosFactoresService dosFactores;
    private final Duration ventana;

    public ReautenticacionService(SesionService sesiones, DosFactoresService dosFactores,
                                  @Value("${app.sesion.reautenticacion:5m}") Duration ventana) {
        this.sesiones = sesiones;
        this.dosFactores = dosFactores;
        this.ventana = ventana;
    }

    public boolean vigente(String sesionId) {
        return sesiones.reautenticadaDentroDe(sesionId, ventana);
    }

    /** Hasta cuando vale la reautenticacion recien confirmada, o null si la sesion ya no es valida. */
    public Instant confirmar(String sesionId, Long usuarioId) {
        Instant ahora = sesiones.marcarReautenticada(sesionId, usuarioId);
        return ahora == null ? null : ahora.plus(ventana);
    }

    public Metodo metodo(Long usuarioId) {
        return usuarioId != null && dosFactores.activo(usuarioId) ? Metodo.CODIGO : Metodo.PASSWORD;
    }
}
