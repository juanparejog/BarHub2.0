package com.daw2.barhub.auth.controllers;

import com.daw2.barhub.auth.payload.request.LoginRequest;
import com.daw2.barhub.auth.services.LoginAttemptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerBloqueoTest {

    @Mock
    private AuthenticationManager authenticationManager;

    private AuthController controller;

    @BeforeEach
    void preparar() {
        controller = new AuthController();
        ReflectionTestUtils.setField(controller, "authenticationManager", authenticationManager);
        ReflectionTestUtils.setField(controller, "loginAttemptService", new LoginAttemptService());
    }

    private LoginRequest peticion(String usuario) {
        LoginRequest r = new LoginRequest();
        r.setUsername(usuario);
        r.setPassword("incorrecta");
        return r;
    }

    @Test
    void tras_cinco_fallos_responde_429_sin_volver_a_autenticar() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("mal"));

        for (int i = 0; i < LoginAttemptService.MAX_INTENTOS; i++) {
            assertThrows(BadCredentialsException.class, () -> controller.authenticateUser(peticion("juan"), new MockHttpServletRequest()));
        }

        ResponseEntity<?> respuesta = controller.authenticateUser(peticion("juan"), new MockHttpServletRequest());
        assertEquals(429, respuesta.getStatusCode().value());
        assertEquals("900", respuesta.getHeaders().getFirst("Retry-After"));
        // el sexto intento ni siquiera llega al gestor de autenticacion
        verify(authenticationManager, times(LoginAttemptService.MAX_INTENTOS)).authenticate(any());
    }

    @Test
    void el_bloqueo_de_un_usuario_no_afecta_a_otro() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("mal"));

        for (int i = 0; i < LoginAttemptService.MAX_INTENTOS; i++) {
            assertThrows(BadCredentialsException.class, () -> controller.authenticateUser(peticion("juan"), new MockHttpServletRequest()));
        }
        assertThrows(BadCredentialsException.class, () -> controller.authenticateUser(peticion("maria"), new MockHttpServletRequest()));
    }
}
