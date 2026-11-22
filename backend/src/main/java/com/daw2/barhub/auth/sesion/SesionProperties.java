package com.daw2.barhub.auth.sesion;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;

/**
 * Limites de las sesiones ({@code app.sesion} en application.yml).
 *
 * <p>Cada rol tiene un tiempo maximo de inactividad y una duracion maxima de la sesion, aunque haya
 * actividad. Un usuario con varios roles recibe el limite mas estricto de cada tipo. Las claves de
 * {@code roles} son el nombre del rol sin el prefijo {@code ROLE_} y en minusculas.
 */
@ConfigurationProperties(prefix = "app.sesion")
public record SesionProperties(Cookie cookie, Duration graciaRotacion, Map<String, Limite> roles) {

    /** Para un rol sin limite configurado. */
    static final Limite LIMITE_POR_DEFECTO = new Limite(Duration.ofMinutes(30), Duration.ofHours(8));

    public SesionProperties {
        cookie = cookie != null ? cookie : new Cookie(null, null, null);
        graciaRotacion = graciaRotacion != null ? graciaRotacion : Duration.ofSeconds(30);
        roles = roles != null ? Map.copyOf(roles) : Map.of(
                "admin", new Limite(Duration.ofMinutes(15), Duration.ofHours(8)),
                "empleado", new Limite(Duration.ofMinutes(30), Duration.ofHours(10)),
                "cliente", new Limite(Duration.ofHours(1), Duration.ofHours(12)));
    }

    public Limite limitePara(Collection<String> rolesUsuario) {
        Duration inactividad = null;
        Duration maximo = null;
        for (String rol : rolesUsuario) {
            Limite limite = roles.get(clave(rol));
            if (limite != null) {
                inactividad = menor(inactividad, limite.inactividad());
                maximo = menor(maximo, limite.maximo());
            }
        }
        return inactividad == null ? LIMITE_POR_DEFECTO : new Limite(inactividad, maximo);
    }

    static String clave(String rol) {
        return rol.replaceFirst("^ROLE_", "").toLowerCase(Locale.ROOT);
    }

    private static Duration menor(Duration actual, Duration candidata) {
        return actual == null || candidata.compareTo(actual) < 0 ? candidata : actual;
    }

    /** Cookie del token de renovacion. La ruta es la que ve el navegador (Caddy publica la API en /api). */
    public record Cookie(String nombre, String ruta, Boolean segura) {
        public Cookie {
            nombre = nombre != null ? nombre : "barhub_refresh";
            ruta = ruta != null ? ruta : "/api/auth";
            segura = segura != null ? segura : Boolean.TRUE;
        }
    }

    public record Limite(Duration inactividad, Duration maximo) {
    }
}
