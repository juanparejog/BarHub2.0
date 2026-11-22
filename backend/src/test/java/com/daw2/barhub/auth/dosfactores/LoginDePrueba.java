package com.daw2.barhub.auth.dosfactores;

import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Login completo para los tests de integracion, como lo haria el navegador: si el usuario tiene (o
 * necesita) la verificacion en dos pasos, la configura o calcula el codigo como lo haria la app.
 * Recuerda el secreto de cada usuario y no repite un codigo ya usado.
 */
public class LoginDePrueba {

    private final MockMvc mvc;
    private final ObjectMapper mapper;
    private final String ip;
    private final Map<String, byte[]> secretos = new HashMap<>();
    private final Map<String, Long> ultimoPaso = new HashMap<>();
    private final Map<String, List<String>> codigosRecuperacion = new HashMap<>();

    public LoginDePrueba(MockMvc mvc, ObjectMapper mapper) {
        this(mvc, mapper, "127.0.0.1");
    }

    /** Con {@code ip} como direccion del cliente (el bloqueo del login tambien cuenta por IP). */
    public LoginDePrueba(MockMvc mvc, ObjectMapper mapper, String ip) {
        this.mvc = mvc;
        this.mapper = mapper;
        this.ip = ip;
    }

    /** Token de acceso tras completar el login. */
    public String token(String usuario, String clave) throws Exception {
        return String.valueOf(iniciarSesion(usuario, clave).get("token"));
    }

    /** JSON de la respuesta final del login (con token), pasando por el segundo paso si hace falta. */
    public Map<?, ?> iniciarSesion(String usuario, String clave) throws Exception {
        Map<?, ?> respuesta = json(post("/auth/login", Map.of("username", usuario, "password", clave)));
        if (!Boolean.TRUE.equals(respuesta.get("requiere2fa"))) {
            return respuesta;
        }
        String desafio = String.valueOf(respuesta.get("desafio"));
        if (Boolean.TRUE.equals(respuesta.get("configurar"))) {
            Map<?, ?> configuracion = json(post("/auth/2fa/configurar", Map.of("desafio", desafio)));
            secretos.put(usuario, Base32.decodificar(String.valueOf(configuracion.get("secreto"))));
            ultimoPaso.remove(usuario);
            Map<?, ?> activado = json(post("/auth/2fa/activar", Map.of("desafio", desafio, "codigo", codigoSiguiente(usuario))));
            codigosRecuperacion.put(usuario, ((List<?>) activado.get("codigosRecuperacion")).stream().map(String::valueOf).toList());
            return activado;
        }
        return json(post("/auth/2fa/verificar", Map.of("desafio", desafio, "codigo", codigoSiguiente(usuario))));
    }

    /** Codigo de la app de un paso que aun no se ha usado (el actual o, si ya se uso, el siguiente). */
    public String codigoSiguiente(String usuario) {
        byte[] secreto = secretos.get(usuario);
        if (secreto == null) {
            throw new IllegalStateException("No se conoce el secreto TOTP de " + usuario);
        }
        long paso = Math.max(Totp.paso(Instant.now()), ultimoPaso.getOrDefault(usuario, Long.MIN_VALUE) + 1);
        ultimoPaso.put(usuario, paso);
        return Totp.codigo(secreto, paso);
    }

    /** Paso del ultimo codigo de la app que se ha enviado para {@code usuario}. */
    public long ultimoPaso(String usuario) {
        return ultimoPaso.get(usuario);
    }

    public byte[] secreto(String usuario) {
        return secretos.get(usuario);
    }

    public List<String> codigosRecuperacion(String usuario) {
        return codigosRecuperacion.get(usuario);
    }

    public MockHttpServletResponse post(String ruta, Map<String, String> cuerpo) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.post(ruta)
                        .with(peticion -> {
                            peticion.setRemoteAddr(ip);
                            return peticion;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(cuerpo)))
                .andReturn().getResponse();
    }

    public Map<?, ?> json(MockHttpServletResponse respuesta) throws Exception {
        if (respuesta.getStatus() != 200) {
            throw new AssertionError("HTTP " + respuesta.getStatus() + ": " + respuesta.getContentAsString());
        }
        return mapper.readValue(respuesta.getContentAsString(), Map.class);
    }
}
