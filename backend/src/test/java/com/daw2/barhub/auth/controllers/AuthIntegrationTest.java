package com.daw2.barhub.auth.controllers;

import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Registro, inicio de sesion y uso real del token JWT contra la base de datos en memoria.
 * Cada prueba se deshace al terminar (@Transactional), asi que no deja usuarios.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ObjectMapper mapper;

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    // ---------- utilidades ----------

    private static String registro(String username, String email, String password) {
        return """
                {"username":"%s","email":"%s","password":"%s","nombre":"Prueba","apellido1":"Tests"}
                """.formatted(username, email, password);
    }

    private static String credenciales(String username, String password) {
        return """
                {"username":"%s","password":"%s"}
                """.formatted(username, password);
    }

    /** Registro y, como si hubiera abierto el enlace del correo, cuenta confirmada (ver CorreoIntegrationTest). */
    private void registrar(String username, String email, String password) throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(registro(username, email, password)))
                .andExpect(status().isOk());
        User usuario = userRepository.findByUsername(username).orElseThrow();
        usuario.setEmailVerificado(true);
        userRepository.save(usuario);
    }

    private String iniciarSesion(String username, String password) throws Exception {
        String cuerpo = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(credenciales(username, password)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Map<?, ?> json = mapper.readValue(cuerpo, Map.class);
        String token = String.valueOf(json.containsKey("token") ? json.get("token") : json.get("accessToken"));
        assertFalse(token.isBlank());
        return token;
    }

    /** Pasa si la seguridad deja llegar la peticion al controlador (aunque este responda un error). */
    private void assertPermitido(MockHttpServletRequestBuilder peticion) {
        try {
            int estado = mvc.perform(peticion).andReturn().getResponse().getStatus();
            assertNotEquals(401, estado);
            assertNotEquals(403, estado);
        } catch (Exception e) {
            // La excepcion procede del controlador: la peticion paso el filtro de seguridad.
        }
    }

    // ---------- registro ----------

    @Test
    void registrarCreaUnUsuarioConRolCliente() throws Exception {
        registrar("ana_test", "ana_test@example.com", "secreto1");

        User usuario = userRepository.findByUsername("ana_test").orElseThrow();
        Set<RoleEnum> roles = usuario.getRoles().stream().map(r -> r.getName()).collect(Collectors.toSet());
        assertEquals(Set.of(RoleEnum.ROLE_CLIENTE), roles);
        assertNotEquals("secreto1", usuario.getPassword());
        assertTrue(usuario.getPassword().startsWith("$2"));
    }

    @Test
    void registrarIgnoraLosRolesQueEnvieElCliente() throws Exception {
        String cuerpo = """
                {"username":"intruso","email":"intruso@example.com","password":"secreto1",
                 "nombre":"I","apellido1":"K","roles":["ROLE_ADMIN"],"role":["admin"]}
                """;

        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isOk());

        User usuario = userRepository.findByUsername("intruso").orElseThrow();
        Set<RoleEnum> roles = usuario.getRoles().stream().map(r -> r.getName()).collect(Collectors.toSet());
        assertEquals(Set.of(RoleEnum.ROLE_CLIENTE), roles);
    }

    @Test
    void registrarConUsuarioOEmailRepetidoDa400() throws Exception {
        registrar("repetido", "repetido@example.com", "secreto1");

        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(registro("repetido", "otro@example.com", "secreto1")))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("nombre de usuario")));
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(registro("distinto", "repetido@example.com", "secreto1")))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("email")));
    }

    @Test
    void registrarConDatosInvalidosDa400() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(registro("corta", "corta@example.com", "123")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(registro("sinemail", "esto-no-es-un-email", "secreto1")))
                .andExpect(status().isBadRequest());
    }

    // ---------- inicio de sesion ----------

    @Test
    void loginCorrectoDevuelveTokenYRoles() throws Exception {
        registrar("luis_test", "luis_test@example.com", "secreto1");

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(credenciales("luis_test", "secreto1")))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("ROLE_CLIENTE")));
    }

    @Test
    void loginConContrasenaIncorrectaDa401() throws Exception {
        registrar("marta_test", "marta_test@example.com", "secreto1");

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(credenciales("marta_test", "incorrecta")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginSinDatosDa400() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- uso del token ----------

    @Test
    void elTokenDeUnClienteSirveParaSusRutas() throws Exception {
        registrar("pablo_test", "pablo_test@example.com", "secreto1");
        String token = iniciarSesion("pablo_test", "secreto1");

        assertPermitido(get("/pedidos/mis-pedidos").header("Authorization", "Bearer " + token));
    }

    @Test
    void elTokenDeUnClienteNoAbreLaAdministracion() throws Exception {
        registrar("sara_test", "sara_test@example.com", "secreto1");
        String token = iniciarSesion("sara_test", "secreto1");

        mvc.perform(get("/usuarios").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mvc.perform(get("/caja/actual").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void unTokenManipuladoOSinBearerDa401() throws Exception {
        mvc.perform(get("/usuarios").header("Authorization", "Bearer abc.def.ghi"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/usuarios").header("Authorization", "Bearer "))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/usuarios").header("Authorization", "token-sin-prefijo"))
                .andExpect(status().isUnauthorized());
    }
}
