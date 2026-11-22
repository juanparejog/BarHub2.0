package com.daw2.barhub.controller;

import com.daw2.barhub.auth.dosfactores.LoginDePrueba;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.HashSet;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Registro de jornada de punta a punta: el login de un empleado abre su turno, "Terminar turno" lo
 * cierra, y solo el administrador ve el listado. Cada prueba se deshace al terminar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TurnoIntegrationTest {

    private static final String CLAVE = "Secreto123";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper mapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private LoginDePrueba login;

    @BeforeEach
    void crearUsuarios() {
        login = new LoginDePrueba(mvc, mapper);
        crear("turno_emp", RoleEnum.ROLE_EMPLEADO);
        crear("turno_admin", RoleEnum.ROLE_ADMIN);
        crear("turno_cli", RoleEnum.ROLE_CLIENTE);
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private void crear(String username, RoleEnum rol) {
        Role role = roleRepository.findByName(rol)
                .orElseGet(() -> roleRepository.saveAndFlush(Role.builder().name(rol).build()));
        userRepository.saveAndFlush(User.builder()
                .username(username)
                .email(username + "@test.local")
                .password(passwordEncoder.encode(CLAVE))
                .nombre("Prueba")
                .apellido1("Tests")
                .roles(new HashSet<>(Set.of(role)))
                .build());
    }

    /** Login completo; el empleado y el administrador pasan por la verificacion en dos pasos. */
    private String token(String username) throws Exception {
        return "Bearer " + login.token(username, CLAVE);
    }

    @Test
    void elLoginDelEmpleadoAbreSuTurnoYTerminarloLoCierra() throws Exception {
        String empleado = token("turno_emp");

        mvc.perform(get("/turnos/actual").header("Authorization", empleado))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("turno_emp"))
                .andExpect(jsonPath("$.salida").doesNotExist());

        mvc.perform(post("/turnos/terminar").header("Authorization", empleado))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cierre").value("TERMINADO"))
                .andExpect(jsonPath("$.salida").isNumber());

        mvc.perform(get("/turnos/actual").header("Authorization", empleado))
                .andExpect(status().isNoContent());
        mvc.perform(post("/turnos/terminar").header("Authorization", empleado))
                .andExpect(status().isConflict());
    }

    @Test
    void elAdministradorNoFichaPeroVeElRegistroDeJornada() throws Exception {
        token("turno_emp");
        String admin = token("turno_admin");

        mvc.perform(get("/turnos/actual").header("Authorization", admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/turnos").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username == 'turno_emp')]").exists());
    }

    @Test
    void elListadoCompletoEsSoloParaAdministradores() throws Exception {
        mvc.perform(get("/turnos").header("Authorization", token("turno_emp")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/turnos/actual").header("Authorization", token("turno_cli")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/turnos")).andExpect(status().isUnauthorized());
    }

    @Test
    void unRangoDeFechasNoValidoDa400() throws Exception {
        String admin = token("turno_admin");
        mvc.perform(get("/turnos").param("desde", "2026-11-22").param("hasta", "2026-11-01")
                        .header("Authorization", admin))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/turnos").param("desde", "2024-01-01").param("hasta", "2026-11-01")
                        .header("Authorization", admin))
                .andExpect(status().isBadRequest());
    }
}
