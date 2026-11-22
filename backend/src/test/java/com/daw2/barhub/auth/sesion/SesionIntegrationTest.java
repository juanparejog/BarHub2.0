package com.daw2.barhub.auth.sesion;

import com.daw2.barhub.auth.jwt.JwtUtils;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.services.UserDetailsImpl;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sesiones de punta a punta contra la base de datos en memoria: cookie de renovacion, rotacion,
 * cierre de sesion y tokens de acceso ligados a la sesion. Cada prueba se deshace al terminar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SesionIntegrationTest {

    private static final String COOKIE = "barhub_refresh";
    private static final String USUARIO = "sesion_test";
    private static final String CLAVE = "Secreto123";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper mapper;
    @Autowired
    private JwtUtils jwtUtils;
    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void registrar() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                        {"username":"%s","email":"%s@example.com","password":"%s","nombre":"Prueba","apellido1":"Tests"}
                        """.formatted(USUARIO, USUARIO, CLAVE)))
                .andExpect(status().isOk());
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    /** Token de acceso y valor de la cookie de renovacion de una respuesta. */
    private record Credenciales(String acceso, String renovacion) {
    }

    private Credenciales leer(MockHttpServletResponse respuesta) throws Exception {
        Map<?, ?> json = mapper.readValue(respuesta.getContentAsString(), Map.class);
        Object token = json.containsKey("token") ? json.get("token") : json.get("accessToken");
        return new Credenciales(String.valueOf(token), valorCookie(respuesta));
    }

    private static String valorCookie(MockHttpServletResponse respuesta) {
        String cabecera = respuesta.getHeader(HttpHeaders.SET_COOKIE);
        if (cabecera == null || !cabecera.startsWith(COOKIE + "=")) {
            return null;
        }
        return cabecera.substring(COOKIE.length() + 1, cabecera.indexOf(';'));
    }

    private Credenciales iniciarSesion() throws Exception {
        MockHttpServletResponse respuesta = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(USUARIO, CLAVE)))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        return leer(respuesta);
    }

    @Test
    void elLoginEntregaLaRenovacionEnUnaCookieProtegida() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(USUARIO, CLAVE)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString(COOKIE + "=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Strict")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/api/auth")))
                // limites del cliente para el aviso del frontend: 1 hora de inactividad
                .andExpect(jsonPath("$.sesionInactividadSegundos").value(3600))
                .andExpect(jsonPath("$.sesionCaducaEn").isNumber());
    }

    @Test
    void laCookieRenuevaElTokenDeAccesoYSeRota() throws Exception {
        Credenciales login = iniciarSesion();
        assertNotNull(login.renovacion());

        MockHttpServletResponse respuesta = mvc.perform(post("/auth/refresh").cookie(new Cookie(COOKIE, login.renovacion())))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        Credenciales renovadas = leer(respuesta);

        assertFalse(renovadas.acceso().isBlank());
        assertNotNull(renovadas.renovacion());
        assertNotEquals(login.renovacion(), renovadas.renovacion());
        mvc.perform(get("/pedidos/mis-pedidos").header("Authorization", "Bearer " + renovadas.acceso()))
                .andExpect(status().isOk());
    }

    @Test
    void sinCookieOConUnaInventadaNoHayRenovacion() throws Exception {
        mvc.perform(post("/auth/refresh")).andExpect(status().isUnauthorized());
        mvc.perform(post("/auth/refresh").cookie(new Cookie(COOKIE, "inventada")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));
    }

    @Test
    void cerrarSesionInvalidaAlMomentoElTokenDeAccesoYLaRenovacion() throws Exception {
        Credenciales login = iniciarSesion();
        mvc.perform(get("/pedidos/mis-pedidos").header("Authorization", "Bearer " + login.acceso()))
                .andExpect(status().isOk());

        mvc.perform(post("/auth/logout").cookie(new Cookie(COOKIE, login.renovacion())))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

        mvc.perform(get("/pedidos/mis-pedidos").header("Authorization", "Bearer " + login.acceso()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/auth/refresh").cookie(new Cookie(COOKIE, login.renovacion())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unTokenBienFirmadoPeroSinSesionAbiertaNoSirve() throws Exception {
        UserDetailsImpl detalles = UserDetailsImpl.build(userRepository.findByUsername(USUARIO).orElseThrow());
        assertTrue(detalles.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CLIENTE")));

        String sinSesion = jwtUtils.generarTokenAcceso(detalles, null);
        String sesionInventada = jwtUtils.generarTokenAcceso(detalles, "00000000-0000-0000-0000-000000000000");

        for (String token : List.of(sinSesion, sesionInventada)) {
            mvc.perform(get("/pedidos/mis-pedidos").header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
    }
}
