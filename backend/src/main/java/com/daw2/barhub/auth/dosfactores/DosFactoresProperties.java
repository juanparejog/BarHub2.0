package com.daw2.barhub.auth.dosfactores;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * Verificacion en dos pasos ({@code app.dos-factores} en application.yml).
 *
 * @param obligatorio roles que no pueden entrar sin ella, con el mismo formato que en
 *                    {@code app.sesion.roles}: sin el prefijo {@code ROLE_} y en minusculas
 * @param emisor      nombre con el que aparece la cuenta en la app de autenticacion
 * @param clave       clave maestra para cifrar los secretos TOTP y firmar los codigos de
 *                    recuperacion; si esta vacia se deriva de {@code JWT_SECRET}
 */
@ConfigurationProperties(prefix = "app.dos-factores")
public record DosFactoresProperties(List<String> obligatorio, String emisor, String clave) {

    public DosFactoresProperties {
        obligatorio = obligatorio != null
                ? obligatorio.stream().map(DosFactoresProperties::normalizar).filter(r -> !r.isEmpty()).toList()
                : List.of("admin", "empleado");
        emisor = emisor != null && !emisor.isBlank() ? emisor : "BarHub";
    }

    /** Si alguno de los roles del usuario obliga a usar la verificacion en dos pasos. */
    public boolean obligatorioPara(Collection<String> roles) {
        return roles.stream().map(DosFactoresProperties::normalizar).anyMatch(obligatorio::contains);
    }

    private static String normalizar(String rol) {
        return rol == null ? "" : rol.trim().replaceFirst("^ROLE_", "").toLowerCase(Locale.ROOT);
    }
}
