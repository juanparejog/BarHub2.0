package com.daw2.barhub.auth.services;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Frena los ataques de fuerza bruta contra el login: tras MAX_INTENTOS fallos seguidos
 * de un mismo usuario se bloquea el acceso durante DURACION_BLOQUEO.
 * Funciona en memoria (una sola instancia del backend): al reiniciar se borra todo.
 */
@Service
public class LoginAttemptService {

    public static final int MAX_INTENTOS = 5;
    public static final Duration DURACION_BLOQUEO = Duration.ofMinutes(15);
    private static final int LIMITE_REGISTROS = 10_000;

    private final Clock reloj;
    private final ConcurrentHashMap<String, Registro> registros = new ConcurrentHashMap<>();

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    LoginAttemptService(Clock reloj) {
        this.reloj = reloj;
    }

    public boolean estaBloqueado(String usuario) {
        return segundosRestantes(usuario) > 0;
    }

    /** Segundos que faltan para que se levante el bloqueo; 0 si no esta bloqueado. */
    public long segundosRestantes(String usuario) {
        Registro r = registros.get(clave(usuario));
        if (r == null || r.bloqueadoHasta == null) {
            return 0;
        }
        long milis = Duration.between(reloj.instant(), r.bloqueadoHasta).toMillis();
        // se redondea hacia arriba: si queda medio segundo, el usuario todavia esta bloqueado
        return milis <= 0 ? 0 : (milis + 999) / 1000;
    }

    public void registrarFallo(String usuario) {
        Instant ahora = reloj.instant();
        if (registros.size() >= LIMITE_REGISTROS) {
            limpiarCaducados(ahora);
        }
        registros.compute(clave(usuario), (k, actual) -> {
            Registro r = (actual == null || actual.caducado(ahora)) ? new Registro() : actual;
            r.fallos++;
            r.ultimoFallo = ahora;
            if (r.fallos >= MAX_INTENTOS) {
                r.bloqueadoHasta = ahora.plus(DURACION_BLOQUEO);
            }
            return r;
        });
    }

    public void registrarExito(String usuario) {
        registros.remove(clave(usuario));
    }

    private void limpiarCaducados(Instant ahora) {
        registros.entrySet().removeIf(e -> e.getValue().caducado(ahora));
    }

    private static String clave(String usuario) {
        return usuario == null ? "" : usuario.trim().toLowerCase(Locale.ROOT);
    }

    private static final class Registro {
        private int fallos;
        private Instant ultimoFallo;
        private Instant bloqueadoHasta;

        private boolean caducado(Instant ahora) {
            if (bloqueadoHasta != null) {
                return !ahora.isBefore(bloqueadoHasta);
            }
            return ultimoFallo != null && ultimoFallo.plus(DURACION_BLOQUEO).isBefore(ahora);
        }
    }
}
