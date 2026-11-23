package com.daw2.barhub.auth.reautenticacion;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import com.daw2.barhub.auth.sesion.SesionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

/**
 * Aplica {@link RequiereReautenticacion}: antes de ejecutar una accion critica de un administrador
 * comprueba que se ha reautenticado hace poco en esta sesion. Si no, responde 403 con
 * {@code {"code":"REAUTENTICACION_REQUERIDA","metodo":"codigo"|"password"}} sin ejecutar nada.
 *
 * <p>Un principal que no sea {@link UserDetailsImpl} (no llega con un token de BarHub) no tiene
 * sesion que comprobar: se le exige siempre.
 */
@Component
public class ReautenticacionInterceptor implements HandlerInterceptor {

    private final ReautenticacionService reautenticacion;

    public ReautenticacionInterceptor(ReautenticacionService reautenticacion) {
        this.reautenticacion = reautenticacion;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (!(handler instanceof HandlerMethod metodo)) {
            return true;
        }
        RequiereReautenticacion anotacion = metodo.getMethodAnnotation(RequiereReautenticacion.class);
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (anotacion == null || !autenticado(autenticacion)
                || (!anotacion.paraTodos() && !esAdministrador(autenticacion))) {
            return true;
        }
        Long usuarioId = autenticacion.getPrincipal() instanceof UserDetailsImpl usuario ? usuario.getId() : null;
        if (anotacion.soloSobreOtroUsuario() && usuarioId != null && usuarioId.equals(idDeLaRuta(request))) {
            return true;
        }
        if (reautenticacion.vigente((String) request.getAttribute(SesionService.ATRIBUTO_SESION))) {
            return true;
        }

        String metodoConfirmacion = reautenticacion.metodo(usuarioId).name().toLowerCase(Locale.ROOT);
        String mensaje = metodoConfirmacion.equals("codigo")
                ? "Para continuar, escribe el código de tu app de autenticación."
                : "Para continuar, escribe tu contraseña.";
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"" + ReautenticacionService.CODIGO_REQUERIDA + "\",\"metodo\":\""
                + metodoConfirmacion + "\",\"message\":\"" + mensaje + "\"}");
        return false;
    }

    /** Sin sesion (anonimo) no hay nada que comprobar aqui: la seguridad de la ruta responde 401. */
    private static boolean autenticado(Authentication autenticacion) {
        return autenticacion != null && autenticacion.isAuthenticated()
                && !(autenticacion instanceof AnonymousAuthenticationToken);
    }

    private static boolean esAdministrador(Authentication autenticacion) {
        return autenticacion.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    private static Long idDeLaRuta(HttpServletRequest request) {
        Object variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (variables instanceof Map<?, ?> mapa && mapa.get("id") instanceof String id) {
            try {
                return Long.valueOf(id);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
