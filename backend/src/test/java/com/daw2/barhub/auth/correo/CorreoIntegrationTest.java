package com.daw2.barhub.auth.correo;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Confirmacion del correo y recuperacion de la contrasena de punta a punta. El envio se sustituye
 * por un doble que guarda el texto del correo, de donde se saca el enlace como haria el usuario.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CorreoIntegrationTest {

    private static final String USUARIO = "correo_test";
    private static final String EMAIL = "correo_test@example.com";
    private static final String CLAVE = "Secreto123";
    private static final Pattern ENLACE = Pattern.compile("/auth/(verificar|restablecer)#token=([\\w-]+)");

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @MockitoBean
    private CorreoService correo;

    @BeforeEach
    void registrar() throws Exception {
        mvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                        {"username":"%s","email":"%s","password":"%s","nombre":"Ana","apellido1":"Tests"}
                        """.formatted(USUARIO, EMAIL, CLAVE)))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("correo")));
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    /** Token del ultimo correo enviado a EMAIL con ese asunto. */
    private String tokenDelCorreo(String asunto) {
        ArgumentCaptor<String> texto = ArgumentCaptor.forClass(String.class);
        verify(correo, org.mockito.Mockito.atLeastOnce()).enviar(eq(EMAIL), eq(asunto), texto.capture());
        List<String> textos = texto.getAllValues();
        Matcher enlace = ENLACE.matcher(textos.get(textos.size() - 1));
        assertTrue(enlace.find(), "el correo lleva el enlace");
        return enlace.group(2);
    }

    private MockHttpServletResponse login(String clave) throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(USUARIO, clave)))
                .andReturn().getResponse();
    }

    private String cookieRenovacion(MockHttpServletResponse respuesta) {
        String cabecera = respuesta.getHeader(HttpHeaders.SET_COOKIE);
        return cabecera.substring("barhub_refresh=".length(), cabecera.indexOf(';'));
    }

    private void confirmar() throws Exception {
        mvc.perform(post("/auth/verificar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(tokenDelCorreo("Confirma tu correo en BarHub"))))
                .andExpect(status().isOk());
    }

    @Test
    void sinConfirmarElCorreoNoSePuedeIniciarSesion() throws Exception {
        User usuario = userRepository.findByUsername(USUARIO).orElseThrow();
        assertFalse(usuario.correoVerificado());

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(USUARIO, CLAVE)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_NO_VERIFICADO"));
    }

    @Test
    void conElEnlaceDelCorreoLaCuentaQuedaConfirmadaYElEnlaceNoSirveDosVeces() throws Exception {
        String token = tokenDelCorreo("Confirma tu correo en BarHub");

        mvc.perform(post("/auth/verificar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(token)))
                .andExpect(status().isOk());
        assertEquals(200, login(CLAVE).getStatus());

        mvc.perform(post("/auth/verificar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unTokenInventadoNoConfirmaNada() throws Exception {
        mvc.perform(post("/auth/verificar").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"inventado\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/auth/restablecer").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"inventado\",\"password\":\"OtraClave99\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reenviarEnElMismoMinutoNoMandaOtroCorreo() throws Exception {
        // recien registrado: el reenvio inmediato no manda otro correo
        mvc.perform(post("/auth/reenviar-verificacion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"%s\"}".formatted(USUARIO)))
                .andExpect(status().isOk());
        verify(correo, times(1)).enviar(eq(EMAIL), eq("Confirma tu correo en BarHub"), anyString());
    }

    @Test
    void recuperarResponderLoMismoExistaONoLaCuenta() throws Exception {
        String existe = mvc.perform(post("/auth/recuperar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(EMAIL)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String noExiste = mvc.perform(post("/auth/recuperar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nadie@example.com\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertEquals(existe, noExiste);
        verify(correo, never()).enviar(eq("nadie@example.com"), anyString(), anyString());
    }

    @Test
    void restablecerCambiaLaClaveYCierraTodasLasSesiones() throws Exception {
        confirmar();
        MockHttpServletResponse sesionAbierta = login(CLAVE);
        assertEquals(200, sesionAbierta.getStatus());
        String cookie = cookieRenovacion(sesionAbierta);
        clearInvocations(correo);

        mvc.perform(post("/auth/recuperar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(EMAIL.toUpperCase())))
                .andExpect(status().isOk());
        String token = tokenDelCorreo("Restablece tu contraseña de BarHub");

        mvc.perform(post("/auth/restablecer").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"corta\"}".formatted(token)))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/auth/restablecer").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"NuevaClave99\"}".formatted(token)))
                .andExpect(status().isOk());

        assertEquals(401, login(CLAVE).getStatus());
        assertEquals(200, login("NuevaClave99").getStatus());
        // la sesion que estaba abierta ya no se puede renovar
        mvc.perform(post("/auth/refresh").cookie(new Cookie("barhub_refresh", cookie)))
                .andExpect(status().isUnauthorized());
        // y el enlace ya no sirve
        mvc.perform(post("/auth/restablecer").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"OtraClave99\"}".formatted(token)))
                .andExpect(status().isBadRequest());
    }
}
