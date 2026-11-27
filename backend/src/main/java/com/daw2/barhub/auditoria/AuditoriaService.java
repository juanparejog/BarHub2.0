package com.daw2.barhub.auditoria;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.HandlerMapping;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Registro de auditoria: guarda las entradas, las busca para el administrador y borra las que
 * superan el tiempo de conservacion ({@code app.auditoria.dias}, un ano por defecto).
 *
 * <p>Cada entrada se guarda en su propia transaccion: queda aunque la accion falle, y un fallo al
 * guardarla no tumba la accion (solo se anota en el log).
 *
 * <p>Ademas, cada entrada deja en el log una linea para el SOC ({@link #lineaDelSoc}): accion,
 * resultado e IP, sin usuario ni detalle. Se escribe antes de guardar, asi que el SOC la recibe
 * aunque la base de datos falle, y queda fuera de ella aunque alguien la modifique despues.
 */
@Slf4j
@Service
public class AuditoriaService {

    public static final int TAMANO_MAXIMO_PAGINA = 100;

    private final EventoAuditoriaRepository repositorio;
    private final Clock reloj;
    private final Duration conservacion;

    public AuditoriaService(EventoAuditoriaRepository repositorio, Clock reloj,
                            @Value("${app.auditoria.dias:365}") long dias) {
        this.repositorio = repositorio;
        this.reloj = reloj;
        this.conservacion = Duration.ofDays(dias);
    }

    /** Filtros de la pantalla del administrador; los null no filtran. {@code hasta} no se incluye. */
    public record Filtro(Instant desde, Instant hasta, String usuario, AccionAuditoria accion, ResultadoAuditoria resultado) {
    }

    /** Anota la peticion en curso con su resultado (ver AuditoriaInterceptor y AccesoDenegadoAuditado). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrar(AccionAuditoria accion, HttpServletRequest peticion, int estado, Exception excepcion) {
        EventoAuditoria evento = new EventoAuditoria();
        evento.setFecha(reloj.instant());
        evento.setAccion(accion);
        evento.setResultado(resultado(estado, excepcion));
        evento.setPeticion(recortar(peticion.getMethod() + " " + peticion.getRequestURI(), EventoAuditoria.LARGO_PETICION));
        if (!Boolean.TRUE.equals(peticion.getAttribute(Auditoria.SIN_IP))) {
            evento.setIp(recortar(peticion.getRemoteAddr(), EventoAuditoria.LARGO_IP));
        }
        quien(evento, peticion);
        Object objetivo = peticion.getAttribute(Auditoria.OBJETIVO);
        evento.setObjetivo(recortar(objetivo != null ? String.valueOf(objetivo) : idDeLaRuta(peticion), EventoAuditoria.LARGO_OBJETIVO));
        Object detalle = peticion.getAttribute(Auditoria.DETALLE);
        evento.setDetalle(recortar(detalle == null ? null : String.valueOf(detalle), EventoAuditoria.LARGO_DETALLE));
        log.info("{}", lineaDelSoc(evento));
        repositorio.save(evento);
    }

    @Transactional(readOnly = true)
    public Page<EventoAuditoria> buscar(Filtro filtro, int pagina, int tamano) {
        PageRequest orden = PageRequest.of(Math.max(pagina, 0), Math.max(1, Math.min(tamano, TAMANO_MAXIMO_PAGINA)),
                Sort.by(Sort.Order.desc("fecha"), Sort.Order.desc("id")));
        Specification<EventoAuditoria> condiciones = (raiz, consulta, cb) -> {
            List<Predicate> predicados = new ArrayList<>();
            if (filtro.desde() != null) {
                predicados.add(cb.greaterThanOrEqualTo(raiz.<Instant>get("fecha"), filtro.desde()));
            }
            if (filtro.hasta() != null) {
                predicados.add(cb.lessThan(raiz.<Instant>get("fecha"), filtro.hasta()));
            }
            if (filtro.usuario() != null && !filtro.usuario().isBlank()) {
                String patron = "%" + filtro.usuario().strip().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicados.add(cb.like(cb.lower(raiz.<String>get("usuario")), patron, '\\'));
            }
            if (filtro.accion() != null) {
                predicados.add(cb.equal(raiz.get("accion"), filtro.accion()));
            }
            if (filtro.resultado() != null) {
                predicados.add(cb.equal(raiz.get("resultado"), filtro.resultado()));
            }
            return cb.and(predicados.toArray(Predicate[]::new));
        };
        return repositorio.findAll(condiciones, orden);
    }

    /** Las ultimas entradas de un usuario, para la descarga de sus datos. */
    @Transactional(readOnly = true)
    public List<EventoAuditoria> ultimasDe(Long usuarioId) {
        return repositorio.findTop100ByUsuarioIdOrderByFechaDescIdDesc(usuarioId);
    }

    /** Al eliminar una cuenta: sus entradas se quedan, sin su nombre de usuario ni sus IP. */
    @Transactional
    public void anonimizar(Long usuarioId, String usuarioAnterior) {
        repositorio.anonimizar(usuarioId, usuarioAnterior, "eliminado-" + usuarioId);
    }

    @Scheduled(cron = "${app.auditoria.limpieza-cron:0 45 4 * * *}")
    @Transactional
    public void borrarAntiguas() {
        int borradas = repositorio.borrarAnterioresA(reloj.instant().minus(conservacion));
        if (borradas > 0) {
            log.info("Registro de auditoria: {} entradas de hace mas de {} dias borradas", borradas, conservacion.toDays());
        }
    }

    static ResultadoAuditoria resultado(int estado, Exception excepcion) {
        if (excepcion instanceof org.springframework.security.core.AuthenticationException
                || excepcion instanceof org.springframework.security.access.AccessDeniedException) {
            return ResultadoAuditoria.RECHAZADO;
        }
        if (excepcion != null || estado >= 500) {
            return ResultadoAuditoria.ERROR;
        }
        if (estado == 429) {
            return ResultadoAuditoria.BLOQUEADO;
        }
        return estado >= 400 ? ResultadoAuditoria.RECHAZADO : ResultadoAuditoria.CORRECTO;
    }

    private static void quien(EventoAuditoria evento, HttpServletRequest peticion) {
        Object usuario = peticion.getAttribute(Auditoria.USUARIO);
        if (usuario != null) {
            evento.setUsuarioId((Long) peticion.getAttribute(Auditoria.USUARIO_ID));
            evento.setUsuario(recortar(String.valueOf(usuario), EventoAuditoria.LARGO_USUARIO));
            return;
        }
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion != null && !(autenticacion instanceof AnonymousAuthenticationToken)
                && autenticacion.getPrincipal() instanceof UserDetailsImpl sesion) {
            evento.setUsuarioId(sesion.getId());
            evento.setUsuario(recortar(sesion.getUsername(), EventoAuditoria.LARGO_USUARIO));
        }
    }

    private static String idDeLaRuta(HttpServletRequest peticion) {
        Object variables = peticion.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (variables instanceof Map<?, ?> mapa && mapa.get("id") != null) {
            return "id " + mapa.get("id");
        }
        return null;
    }

    /**
     * La linea del log que lee el SOC, en formato clave=valor: {@code evento=auditoria
     * accion=INICIO_SESION resultado=RECHAZADO ip=203.0.113.7}. Sin IP (o si no se guarda), {@code ip=-}.
     * Los valores no llevan espacios, asi que no se pueden inventar campos.
     */
    static String lineaDelSoc(EventoAuditoria evento) {
        String ip = evento.getIp() == null || evento.getIp().isBlank() ? "-" : evento.getIp().replaceAll("\\s", "_");
        return "evento=auditoria accion=" + evento.getAccion() + " resultado=" + evento.getResultado() + " ip=" + ip;
    }

    /** Sin caracteres de control (no se pueden inventar lineas) y con el largo de la columna. */
    static String recortar(String valor, int largo) {
        if (valor == null) {
            return null;
        }
        String limpio = valor.replaceAll("\\p{Cntrl}", " ").strip();
        return limpio.length() > largo ? limpio.substring(0, largo) : limpio;
    }
}
