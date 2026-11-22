package com.daw2.barhub.auth.dosfactores;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Login a medias: la contrasena es correcta y falta el segundo paso. El navegador recibe un token
 * aleatorio (el desafio) que solo sirve para enviar el codigo, durante {@link #DURACION} y como mucho
 * {@link #MAX_INTENTOS} veces. Se guarda en memoria, como los contadores de LoginAttemptService: al
 * reiniciar el backend hay que volver a escribir la contrasena.
 */
@Service
public class DesafioService {

    public static final Duration DURACION = Duration.ofMinutes(5);
    public static final int MAX_INTENTOS = 5;
    private static final int LIMITE_DESAFIOS = 10_000;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    /** VERIFICAR: ya tiene la app configurada. CONFIGURAR: su rol la exige y aun no la ha activado. */
    public enum Proposito { VERIFICAR, CONFIGURAR }

    /** {@code usuario} es el nombre tal como se escribio en el login: es la clave del bloqueo por fallos. */
    public record Desafio(Long usuarioId, String usuario, Proposito proposito) {
    }

    private final Clock reloj;
    private final ConcurrentHashMap<String, Entrada> desafios = new ConcurrentHashMap<>();

    public DesafioService(Clock reloj) {
        this.reloj = reloj;
    }

    public String crear(Long usuarioId, String usuario, Proposito proposito) {
        Instant ahora = reloj.instant();
        if (desafios.size() >= LIMITE_DESAFIOS) {
            desafios.values().removeIf(e -> !ahora.isBefore(e.caducaEn));
        }
        byte[] aleatorio = new byte[32];
        ALEATORIO.nextBytes(aleatorio);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(aleatorio);
        desafios.put(token, new Entrada(new Desafio(usuarioId, usuario, proposito), ahora.plus(DURACION)));
        return token;
    }

    /** El desafio, si existe, no ha caducado y es para {@code proposito}. */
    public Optional<Desafio> consultar(String token, Proposito proposito) {
        if (token == null) {
            return Optional.empty();
        }
        Entrada entrada = desafios.get(token);
        if (entrada == null) {
            return Optional.empty();
        }
        if (!reloj.instant().isBefore(entrada.caducaEn)) {
            desafios.remove(token, entrada);
            return Optional.empty();
        }
        return entrada.desafio.proposito() == proposito ? Optional.of(entrada.desafio) : Optional.empty();
    }

    /** Apunta un codigo incorrecto. Devuelve false si con este se agotan los intentos (el desafio deja de valer). */
    public boolean registrarFallo(String token) {
        Entrada entrada = desafios.computeIfPresent(token, (k, e) -> e.intentos + 1 >= MAX_INTENTOS ? null : e.conFallo());
        return entrada != null;
    }

    public void consumir(String token) {
        if (token != null) {
            desafios.remove(token);
        }
    }

    private record Entrada(Desafio desafio, Instant caducaEn, int intentos) {
        Entrada(Desafio desafio, Instant caducaEn) {
            this(desafio, caducaEn, 0);
        }

        Entrada conFallo() {
            return new Entrada(desafio, caducaEn, intentos + 1);
        }
    }
}
