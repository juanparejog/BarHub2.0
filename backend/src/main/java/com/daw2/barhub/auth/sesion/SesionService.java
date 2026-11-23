package com.daw2.barhub.auth.sesion;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Sesiones con token de acceso corto (JWT) y token de renovacion opaco y rotatorio.
 *
 * <ul>
 *   <li>Cada renovacion entrega un token de renovacion nuevo e invalida el anterior.</li>
 *   <li>Si se presenta un token ya rotado fuera del margen de gracia, alguien lo ha copiado:
 *       se revoca la sesion entera, tambien para quien tenga el token bueno.</li>
 *   <li>El margen de gracia cubre dos pestanas que renuevan a la vez con el mismo token.</li>
 * </ul>
 */
@Slf4j
@Service
public class SesionService {

    public static final String MOTIVO_CIERRE = "CIERRE";
    public static final String MOTIVO_REUTILIZACION = "REUTILIZACION";
    public static final String MOTIVO_CAMBIO_CLAVE = "CAMBIO_CLAVE";
    public static final String MOTIVO_DOS_FACTORES = "DOS_FACTORES";

    /** Atributo de la peticion con el id de la sesion del token de acceso (lo pone AuthTokenFilter). */
    public static final String ATRIBUTO_SESION = SesionService.class.getName() + ".sesion";

    /** La actividad se apunta como mucho una vez por minuto, para no escribir en cada peticion. */
    static final Duration INTERVALO_ACTIVIDAD = Duration.ofMinutes(1);
    /** Las sesiones caducadas o revocadas se conservan una semana por si hay que revisarlas. */
    static final Duration CONSERVACION = Duration.ofDays(7);

    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final SesionRepository repositorio;
    private final SesionProperties propiedades;
    private final Clock reloj;

    public SesionService(SesionRepository repositorio, SesionProperties propiedades, Clock reloj) {
        this.repositorio = repositorio;
        this.propiedades = propiedades;
        this.reloj = reloj;
    }

    /** Sesion recien abierta y su token de renovacion (que solo existe aqui y en la cookie). */
    public record NuevaSesion(Sesion sesion, String tokenRenovacion) {
    }

    /** {@code tokenRenovacion} es null cuando no se rota (renovacion simultanea dentro del margen). */
    public record Renovacion(Sesion sesion, String tokenRenovacion) {
    }

    @Transactional
    public NuevaSesion abrir(Long usuarioId, Collection<String> roles, String ip, String agente) {
        Instant ahora = reloj.instant();
        SesionProperties.Limite limite = propiedades.limitePara(roles);
        String token = generarToken();

        Sesion sesion = new Sesion();
        sesion.setId(UUID.randomUUID().toString());
        sesion.setUsuarioId(usuarioId);
        sesion.setTokenHash(hash(token));
        sesion.setCreada(ahora);
        sesion.setUltimaActividad(ahora);
        sesion.setInactividadSegundos(limite.inactividad().toSeconds());
        sesion.setCaducaEn(ahora.plus(limite.maximo()));
        sesion.setIp(recortar(ip, 45));
        sesion.setAgente(recortar(agente, 255));
        // Acaba de escribir la contrasena (y el codigo, si usa la verificacion en dos pasos)
        sesion.setReautenticadaEn(ahora);
        return new NuevaSesion(repositorio.save(sesion), token);
    }

    // La revocacion por reutilizacion tiene que guardarse aunque se lance la excepcion
    @Transactional(noRollbackFor = SesionInvalidaException.class)
    public Renovacion renovar(String tokenRenovacion) {
        if (tokenRenovacion == null || tokenRenovacion.isBlank()) {
            throw new SesionInvalidaException("Sin token de renovación");
        }
        Instant ahora = reloj.instant();
        String huella = hash(tokenRenovacion);

        Optional<Sesion> vigente = repositorio.findByTokenHash(huella);
        if (vigente.isPresent()) {
            Sesion sesion = exigirVigente(vigente.get(), ahora);
            String nuevo = generarToken();
            sesion.setTokenAnteriorHash(sesion.getTokenHash());
            sesion.setTokenHash(hash(nuevo));
            sesion.setRotadoEn(ahora);
            sesion.setUltimaActividad(ahora);
            return new Renovacion(sesion, nuevo);
        }

        Sesion rotada = repositorio.findByTokenAnteriorHash(huella)
                .orElseThrow(() -> new SesionInvalidaException("Token de renovación desconocido"));
        if (dentroDelMargen(rotada, ahora)) {
            Sesion sesion = exigirVigente(rotada, ahora);
            sesion.setUltimaActividad(ahora);
            return new Renovacion(sesion, null);
        }
        if (rotada.getRevocadaEn() == null) {
            revocar(rotada, ahora, MOTIVO_REUTILIZACION);
            log.warn("Token de renovación reutilizado: se revoca la sesión {} del usuario {}",
                    rotada.getId(), rotada.getUsuarioId());
        }
        throw new SesionInvalidaException("Token de renovación reutilizado");
    }

    /**
     * Comprueba en cada peticion que la sesion del token de acceso sigue abierta y apunta la actividad.
     * Devuelve false si no existe, es de otro usuario, esta revocada o ha caducado.
     */
    @Transactional
    public boolean registrarActividad(String sesionId, Long usuarioId) {
        if (sesionId == null || usuarioId == null) {
            return false;
        }
        Instant ahora = reloj.instant();
        Optional<Sesion> sesion = repositorio.findById(sesionId)
                .filter(s -> usuarioId.equals(s.getUsuarioId()) && s.vigente(ahora));
        sesion.filter(s -> s.getUltimaActividad().plus(INTERVALO_ACTIVIDAD).isBefore(ahora))
                .ifPresent(s -> s.setUltimaActividad(ahora));
        return sesion.isPresent();
    }

    @Transactional
    public void cerrar(String tokenRenovacion) {
        if (tokenRenovacion == null || tokenRenovacion.isBlank()) {
            return;
        }
        String huella = hash(tokenRenovacion);
        repositorio.findByTokenHash(huella)
                .or(() -> repositorio.findByTokenAnteriorHash(huella))
                .filter(s -> s.getRevocadaEn() == null)
                .ifPresent(s -> revocar(s, reloj.instant(), MOTIVO_CIERRE));
    }

    /** Cierra todas las sesiones abiertas de un usuario (por ejemplo, al restablecer la contrasena). */
    @Transactional
    public int cerrarTodas(Long usuarioId) {
        return cerrarTodas(usuarioId, MOTIVO_CAMBIO_CLAVE);
    }

    @Transactional
    public int cerrarTodas(Long usuarioId, String motivo) {
        Instant ahora = reloj.instant();
        List<Sesion> abiertas = repositorio.findByUsuarioIdAndRevocadaEnIsNull(usuarioId);
        abiertas.forEach(s -> revocar(s, ahora, motivo));
        return abiertas.size();
    }

    /** Apunta que el usuario acaba de reautenticarse en esta sesion. Devuelve el instante, o null si la sesion no vale. */
    @Transactional
    public Instant marcarReautenticada(String sesionId, Long usuarioId) {
        if (sesionId == null || usuarioId == null) {
            return null;
        }
        Instant ahora = reloj.instant();
        return repositorio.findById(sesionId)
                .filter(s -> usuarioId.equals(s.getUsuarioId()) && s.vigente(ahora))
                .map(s -> {
                    s.setReautenticadaEn(ahora);
                    repositorio.save(s);
                    return ahora;
                })
                .orElse(null);
    }

    /** Si la sesion sigue abierta y el usuario se ha reautenticado en ella hace menos de {@code ventana}. */
    @Transactional(readOnly = true)
    public boolean reautenticadaDentroDe(String sesionId, Duration ventana) {
        if (sesionId == null) {
            return false;
        }
        Instant ahora = reloj.instant();
        return repositorio.findById(sesionId)
                .filter(s -> s.vigente(ahora) && s.getReautenticadaEn() != null)
                .map(s -> ahora.isBefore(s.getReautenticadaEn().plus(ventana)))
                .orElse(false);
    }

    @Scheduled(cron = "${app.sesion.limpieza-cron:0 15 4 * * *}")
    @Transactional
    public void borrarAntiguas() {
        int borradas = repositorio.borrarAnterioresA(reloj.instant().minus(CONSERVACION));
        if (borradas > 0) {
            log.info("Sesiones caducadas o revocadas borradas: {}", borradas);
        }
    }

    private boolean dentroDelMargen(Sesion sesion, Instant ahora) {
        return sesion.getRotadoEn() != null
                && !ahora.isAfter(sesion.getRotadoEn().plus(propiedades.graciaRotacion()));
    }

    private static Sesion exigirVigente(Sesion sesion, Instant ahora) {
        if (!sesion.vigente(ahora)) {
            throw new SesionInvalidaException("Sesión cerrada o caducada");
        }
        return sesion;
    }

    private static void revocar(Sesion sesion, Instant ahora, String motivo) {
        sesion.setRevocadaEn(ahora);
        sesion.setMotivoRevocacion(motivo);
    }

    private static String generarToken() {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private static String recortar(String texto, int maximo) {
        return texto == null || texto.length() <= maximo ? texto : texto.substring(0, maximo);
    }
}
