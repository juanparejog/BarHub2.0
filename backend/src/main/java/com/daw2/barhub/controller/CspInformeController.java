package com.daw2.barhub.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Recibe los avisos del navegador cuando algo infringe la politica de seguridad de contenido (CSP)
 * que pone Caddy, y los anota en el log con el prefijo "CSP:". Asi se ve en produccion si una
 * pagina intenta cargar un script de fuera (posible XSS) o si un cambio de la aplicacion choca con
 * la politica antes de que alguien lo note.
 *
 * <p>Es publico (el navegador lo envia sin credenciales), asi que no se fia de nada: lee como mucho
 * {@value #TAMANO_MAXIMO} bytes, recorta cada campo, quita los saltos de linea (no se pueden inventar
 * lineas del log) y anota como mucho {@value #MAXIMO_POR_MINUTO} avisos por minuto. Responde siempre
 * 204, valga o no el cuerpo. Acepta los dos formatos: {@code report-uri}
 * ({@code application/csp-report}) y la Reporting API ({@code application/reports+json}).
 */
@Slf4j
@RestController
public class CspInformeController {

    static final int TAMANO_MAXIMO = 16 * 1024;
    static final int MAXIMO_POR_MINUTO = 60;
    private static final int LARGO_CAMPO = 200;

    private final ObjectMapper mapper;
    private final Clock reloj;
    private final AtomicLong minutoActual = new AtomicLong();
    private final AtomicInteger anotadosEsteMinuto = new AtomicInteger();

    public CspInformeController(ObjectMapper mapper, Clock reloj) {
        this.mapper = mapper;
        this.reloj = reloj;
    }

    /** Una infraccion, con los campos que interesan para investigarla. */
    record Infraccion(String directiva, String bloqueado, String pagina, String origen, String modo) {
    }

    @PostMapping("/csp-informe")
    public ResponseEntity<Void> recibir(HttpServletRequest peticion) throws IOException {
        byte[] cuerpo;
        try (InputStream entrada = peticion.getInputStream()) {
            cuerpo = entrada.readNBytes(TAMANO_MAXIMO + 1);
        }
        if (cuerpo.length > TAMANO_MAXIMO) {
            return ResponseEntity.noContent().build();
        }
        for (Infraccion infraccion : leer(new String(cuerpo, StandardCharsets.UTF_8))) {
            if (!cabeEnElCupo()) {
                break;
            }
            log.warn("CSP: {} bloqueo {} en {} (origen {}, modo {})", infraccion.directiva(), infraccion.bloqueado(),
                    infraccion.pagina(), infraccion.origen(), infraccion.modo());
        }
        return ResponseEntity.noContent().build();
    }

    /** Las infracciones de un aviso en cualquiera de los dos formatos; vacia si no es valido. */
    List<Infraccion> leer(String texto) {
        Object json;
        try {
            json = mapper.readValue(texto, Object.class);
        } catch (JacksonException e) {
            return List.of();
        }
        List<Infraccion> infracciones = new ArrayList<>();
        if (json instanceof Map<?, ?> objeto && objeto.get("csp-report") instanceof Map<?, ?> informe) {
            // report-uri: {"csp-report": {"violated-directive": ..., "blocked-uri": ...}}
            infracciones.add(new Infraccion(
                    campo(informe, "effective-directive", "violated-directive"),
                    campo(informe, "blocked-uri"),
                    campo(informe, "document-uri"),
                    origen(campo(informe, "source-file"), informe.get("line-number")),
                    campo(informe, "disposition")));
        } else if (json instanceof List<?> lista) {
            // Reporting API: [{"type": "csp-violation", "body": {...}}, ...]
            for (Object elemento : lista) {
                if (elemento instanceof Map<?, ?> aviso && "csp-violation".equals(aviso.get("type"))
                        && aviso.get("body") instanceof Map<?, ?> cuerpo) {
                    infracciones.add(new Infraccion(
                            campo(cuerpo, "effectiveDirective"),
                            campo(cuerpo, "blockedURL"),
                            campo(cuerpo, "documentURL"),
                            origen(campo(cuerpo, "sourceFile"), cuerpo.get("lineNumber")),
                            campo(cuerpo, "disposition")));
                }
            }
        }
        return infracciones;
    }

    /** Cupo de avisos anotados por minuto, para que nadie llene el disco con avisos falsos. */
    boolean cabeEnElCupo() {
        long minuto = reloj.millis() / 60_000;
        long anterior = minutoActual.getAndSet(minuto);
        if (anterior != minuto) {
            int descartados = anotadosEsteMinuto.getAndSet(0) - MAXIMO_POR_MINUTO;
            if (descartados > 0) {
                log.warn("CSP: {} avisos descartados en el minuto anterior (mas de {} por minuto)",
                        descartados, MAXIMO_POR_MINUTO);
            }
        }
        return anotadosEsteMinuto.incrementAndGet() <= MAXIMO_POR_MINUTO;
    }

    private static String origen(String fichero, Object linea) {
        return linea == null ? fichero : fichero + ":" + limpiar(String.valueOf(linea));
    }

    private static String campo(Map<?, ?> mapa, String... nombres) {
        for (String nombre : nombres) {
            Object valor = mapa.get(nombre);
            if (valor != null && !String.valueOf(valor).isBlank()) {
                return limpiar(String.valueOf(valor));
            }
        }
        return "-";
    }

    /** Sin caracteres de control (saltos de linea incluidos) y como mucho {@value #LARGO_CAMPO}. */
    static String limpiar(String valor) {
        String limpio = valor.replaceAll("\\p{Cntrl}", " ").strip();
        return limpio.length() > LARGO_CAMPO ? limpio.substring(0, LARGO_CAMPO) + "..." : limpio;
    }
}
