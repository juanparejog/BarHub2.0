package com.daw2.barhub.tiemporeal;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import com.daw2.barhub.auth.sesion.SesionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Avisos en tiempo real (Server-Sent Events) para no tener que preguntar cada pocos segundos:
 * comandas, mesas y pagos para el personal, y el seguimiento de sus pedidos para cada cliente.
 */
@RestController
@RequestMapping("/eventos")
public class EventosController {

    private final EventosEnTiempoReal eventos;

    public EventosController(EventosEnTiempoReal eventos) {
        this.eventos = eventos;
    }

    /** Cambios de cualquier pedido o mesa. Solo empleados y administradores (ver SecurityConfig). */
    @GetMapping(value = "/personal", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter personal(@AuthenticationPrincipal UserDetailsImpl yo, HttpServletRequest request) {
        return abrir(EventosEnTiempoReal.Canal.PERSONAL, yo, request);
    }

    /** Cambios de los pedidos del propio usuario. */
    @GetMapping(value = "/mis-pedidos", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter misPedidos(@AuthenticationPrincipal UserDetailsImpl yo, HttpServletRequest request) {
        return abrir(EventosEnTiempoReal.Canal.CLIENTE, yo, request);
    }

    private SseEmitter abrir(EventosEnTiempoReal.Canal canal, UserDetailsImpl yo, HttpServletRequest request) {
        Object sesion = request.getAttribute(SesionService.ATRIBUTO_SESION);
        if (yo == null || sesion == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        try {
            return eventos.suscribir(canal, yo.getId(), sesion.toString());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }
}
