package com.daw2.barhub.auth.services;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Frena los ataques de fuerza bruta contra el login con dos contadores independientes:
 * <ul>
 *   <li><b>Por usuario:</b> tras MAX_INTENTOS fallos seguidos de un mismo usuario se bloquea su
 *       acceso durante DURACION_BLOQUEO, venga de donde venga (adivinar la clave de una cuenta).</li>
 *   <li><b>Por IP:</b> tras MAX_INTENTOS_IP fallos desde una misma IP, sea cual sea el usuario, se
 *       bloquea esa IP durante DURACION_BLOQUEO (probar una clave comun contra muchas cuentas).</li>
 * </ul>
 * Un login correcto limpia el contador de su usuario, pero no el de la IP: quien tenga una cuenta
 * valida no puede usarla para seguir probando las de otros.
 * Funciona en memoria (una sola instancia del backend): al reiniciar se pierden los contadores.
 */
@Slf4j
@Service
public class LoginAttemptService {

    public static final int MAX_INTENTOS = 5;
    public static final int MAX_INTENTOS_IP = 20;
    public static final Duration DURACION_BLOQUEO = Duration.ofMinutes(15);
    private static final int LIMITE_REGISTROS = 10_000;

    private final Clock reloj;
    private final ConcurrentHashMap<String, Registro> porUsuario = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Registro> porIp = new ConcurrentHashMap<>();

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    LoginAttemptService(Clock reloj) {
        this.reloj = reloj;
    }

    public boolean estaBloqueado(String usuario) {
        return segundosRestantes(usuario) > 0;
    }

    /** Segundos que faltan para que se levante el bloqueo del usuario; 0 si no esta bloqueado. */
    public long segundosRestantes(String usuario) {
        return segundosRestantes(porUsuario.get(clave(usuario)));
    }

    /** Lo que mas tarde en levantarse de los dos bloqueos, el del usuario y el de la IP. */
    public long segundosRestantes(String usuario, String ip) {
        return Math.max(segundosRestantes(usuario), segundosRestantes(porIp.get(clave(ip))));
    }

    public void registrarFallo(String usuario) {
        registrarFallo(porUsuario, clave(usuario), MAX_INTENTOS);
    }

    public void registrarFallo(String usuario, String ip) {
        registrarFallo(usuario);
        if (ip != null && !ip.isBlank() && registrarFallo(porIp, clave(ip), MAX_INTENTOS_IP)) {
            log.warn("Login bloqueado {} minutos para la IP {} tras {} intentos fallidos",
                    DURACION_BLOQUEO.toMinutes(), ip, MAX_INTENTOS_IP);
        }
    }

    public void registrarExito(String usuario) {
        porUsuario.remove(clave(usuario));
    }

    /** Devuelve true si este fallo es el que activa el bloqueo. */
    private boolean registrarFallo(ConcurrentHashMap<String, Registro> registros, String clave, int maximo) {
        Instant ahora = reloj.instant();
        if (registros.size() >= LIMITE_REGISTROS) {
            registros.entrySet().removeIf(e -> e.getValue().caducado(ahora));
        }
        Registro registro = registros.compute(clave, (k, actual) -> {
            Registro r = (actual == null || actual.caducado(ahora)) ? new Registro() : actual;
            r.fallos++;
            r.ultimoFallo = ahora;
            if (r.fallos >= maximo && r.bloqueadoHasta == null) {
                r.bloqueadoHasta = ahora.plus(DURACION_BLOQUEO);
                r.recienBloqueado = true;
            } else {
                r.recienBloqueado = false;
            }
            return r;
        });
        return registro.recienBloqueado;
    }

    private long segundosRestantes(Registro r) {
        if (r == null || r.bloqueadoHasta == null) {
            return 0;
        }
        long milis = Duration.between(reloj.instant(), r.bloqueadoHasta).toMillis();
        // se redondea hacia arriba: si queda medio segundo, todavia esta bloqueado
        return milis <= 0 ? 0 : (milis + 999) / 1000;
    }

    private static String clave(String valor) {
        return valor == null ? "" : valor.trim().toLowerCase(Locale.ROOT);
    }

    private static final class Registro {
        private int fallos;
        private Instant ultimoFallo;
        private Instant bloqueadoHasta;
        private boolean recienBloqueado;

        private boolean caducado(Instant ahora) {
            if (bloqueadoHasta != null) {
                return !ahora.isBefore(bloqueadoHasta);
            }
            return ultimoFallo != null && ultimoFallo.plus(DURACION_BLOQUEO).isBefore(ahora);
        }
    }
}
