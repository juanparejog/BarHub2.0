package com.daw2.barhub.auth.jwt;

import com.daw2.barhub.auth.services.UserDetailsImpl;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtUtilsTest {

    private static final String SECRETO = "clave-de-pruebas-solo-para-tests-0123456789-abcdefghij";
    private static final String OTRO_SECRETO = "otra-clave-distinta-solo-para-tests-9876543210-zyxwvutsrq";

    private JwtUtils jwtUtils;

    @BeforeEach
    void preparar() {
        jwtUtils = crear(SECRETO, 60_000);
    }

    private static JwtUtils crear(String secreto, int caducidadMs) {
        JwtUtils utils = new JwtUtils();
        ReflectionTestUtils.setField(utils, "jwtSecret", secreto);
        ReflectionTestUtils.setField(utils, "jwtExpirationMs", caducidadMs);
        return utils;
    }

    private static Authentication autenticacion(String rol) {
        UserDetailsImpl usuario = new UserDetailsImpl(7L, "juan", "juan@example.com", "x",
                List.of(new SimpleGrantedAuthority(rol)));
        return new UsernamePasswordAuthenticationToken(usuario, null, usuario.getAuthorities());
    }

    @Test
    void tokenGeneradoEsValido() {
        String token = jwtUtils.generateJwtToken(autenticacion("ROLE_CLIENTE"));
        assertTrue(jwtUtils.validateJwtToken(token));
    }

    @Test
    void tokenContieneElNombreDeUsuario() {
        String token = jwtUtils.generateJwtToken(autenticacion("ROLE_CLIENTE"));
        assertEquals("juan", jwtUtils.getUserNameFromJwtToken(token));
    }

    @Test
    void tokenContieneIdYRoles() {
        String token = jwtUtils.generateJwtToken(autenticacion("ROLE_EMPLEADO"));
        var claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRETO.getBytes())).build()
                .parseSignedClaims(token).getPayload();
        assertEquals(7, claims.get("id", Integer.class));
        assertTrue(claims.get("roles", List.class).contains("ROLE_EMPLEADO"));
    }

    @Test
    void tokenCaducadoNoEsValido() {
        JwtUtils caducado = crear(SECRETO, -1_000);
        String token = caducado.generateJwtToken(autenticacion("ROLE_CLIENTE"));
        assertFalse(jwtUtils.validateJwtToken(token));
    }

    @Test
    void tokenFirmadoConOtraClaveNoEsValido() {
        String token = crear(OTRO_SECRETO, 60_000).generateJwtToken(autenticacion("ROLE_ADMIN"));
        assertFalse(jwtUtils.validateJwtToken(token));
    }

    @Test
    void textoQueNoEsUnTokenNoEsValido() {
        assertFalse(jwtUtils.validateJwtToken("esto-no-es-un-jwt"));
    }

    @Test
    void tokenVacioONuloNoEsValido() {
        assertFalse(jwtUtils.validateJwtToken(""));
        assertFalse(jwtUtils.validateJwtToken(null));
    }
}
