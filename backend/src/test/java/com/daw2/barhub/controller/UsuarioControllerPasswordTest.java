package com.daw2.barhub.controller;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.services.UserService;
import com.daw2.barhub.model.dto.UsuarioDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioControllerPasswordTest {

    private static final String CLAVE_VIEJA = "claveVieja1";

    @Mock
    private UserService userService;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private UsuarioController controller;
    private User juan;

    @BeforeEach
    void preparar() {
        controller = new UsuarioController(userService);
        ReflectionTestUtils.setField(controller, "passwordEncoder", encoder);

        juan = new User();
        juan.setId(1L);
        juan.setUsername("juan");
        juan.setPassword(encoder.encode(CLAVE_VIEJA));
        juan.setNombre("Juan");
        juan.setApellido1("Parejo");
        juan.setRoles(new HashSet<>());
    }

    private Authentication como(String usuario, String rol) {
        return new UsernamePasswordAuthenticationToken(usuario, null, List.of(new SimpleGrantedAuthority(rol)));
    }

    private UsuarioDto cambio(String nueva, String actual) {
        UsuarioDto d = new UsuarioDto();
        d.setNombre("Juan");
        d.setApellido1("Parejo");
        d.setPassword(nueva);
        d.setPasswordActual(actual);
        return d;
    }

    private ResponseEntity<?> actualizar(UsuarioDto dto, Authentication auth) {
        return controller.update(1L, dto, null, auth);
    }

    private void permitirGuardar() {
        when(userService.findById(1L)).thenReturn(juan);
        when(userService.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void clienteCambiaSuContrasenaConLaActualCorrecta() {
        permitirGuardar();
        ResponseEntity<?> r = actualizar(cambio("nuevaClave2", CLAVE_VIEJA), como("juan", "ROLE_CLIENTE"));
        assertEquals(200, r.getStatusCode().value());
        assertTrue(encoder.matches("nuevaClave2", juan.getPassword()));
    }

    @Test
    void sinContrasenaActualSeRechaza() {
        when(userService.findById(1L)).thenReturn(juan);
        ResponseEntity<?> r = actualizar(cambio("nuevaClave2", null), como("juan", "ROLE_CLIENTE"));
        assertEquals(400, r.getStatusCode().value());
        assertTrue(encoder.matches(CLAVE_VIEJA, juan.getPassword()));
        verify(userService, never()).save(any(User.class));
    }

    @Test
    void conContrasenaActualIncorrectaSeRechaza() {
        when(userService.findById(1L)).thenReturn(juan);
        ResponseEntity<?> r = actualizar(cambio("nuevaClave2", "otraCosa"), como("juan", "ROLE_CLIENTE"));
        assertEquals(400, r.getStatusCode().value());
        assertTrue(encoder.matches(CLAVE_VIEJA, juan.getPassword()));
        verify(userService, never()).save(any(User.class));
    }

    @Test
    void sinContrasenaNuevaNoHaceFaltaLaActual() {
        permitirGuardar();
        ResponseEntity<?> r = actualizar(cambio(null, null), como("juan", "ROLE_CLIENTE"));
        assertEquals(200, r.getStatusCode().value());
        assertTrue(encoder.matches(CLAVE_VIEJA, juan.getPassword()));
    }

    @Test
    void adminPuedeRestablecerLaContrasenaDeOtroSinConocerLaActual() {
        permitirGuardar();
        ResponseEntity<?> r = actualizar(cambio("nuevaClave2", null), como("admin", "ROLE_ADMIN"));
        assertEquals(200, r.getStatusCode().value());
        assertTrue(encoder.matches("nuevaClave2", juan.getPassword()));
    }

    @Test
    void adminCambiandoLaSuyaSiNecesitaLaActual() {
        juan.setUsername("admin");
        when(userService.findById(1L)).thenReturn(juan);
        ResponseEntity<?> r = actualizar(cambio("nuevaClave2", null), como("admin", "ROLE_ADMIN"));
        assertEquals(400, r.getStatusCode().value());
        verify(userService, never()).save(any(User.class));
    }

    @Test
    void otroClienteNoPuedeTocarLaCuentaAjena() {
        when(userService.findById(1L)).thenReturn(juan);
        ResponseEntity<?> r = actualizar(cambio("nuevaClave2", CLAVE_VIEJA), como("maria", "ROLE_CLIENTE"));
        assertEquals(404, r.getStatusCode().value());
        assertTrue(encoder.matches(CLAVE_VIEJA, juan.getPassword()));
    }
}
