package com.daw2.barhub.auth.controllers;

import com.daw2.barhub.auth.services.LoginAttemptService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthBloqueoIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void el_login_se_bloquea_con_429_tras_cinco_fallos_reales() throws Exception {
        // usuario que no existe y nombre propio de este test: no interfiere con otros
        String cuerpo = "{\"username\":\"fantasma-bloqueo-it\",\"password\":\"clave-incorrecta\"}";

        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                    .andExpect(status().isUnauthorized());
        }

        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void probarMuchasCuentasDesdeUnaIpBloqueaEsaIp() throws Exception {
        // IP de documentacion (RFC 5737), propia de este test: no afecta al resto de la bateria
        RequestPostProcessor desdeIp = peticion -> {
            peticion.setRemoteAddr("203.0.113.77");
            return peticion;
        };
        for (int i = 0; i < LoginAttemptService.MAX_INTENTOS_IP; i++) {
            mvc.perform(post("/auth/login").with(desdeIp).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"spray-%d\",\"password\":\"Verano2026\"}".formatted(i)))
                    .andExpect(status().isUnauthorized());
        }

        // la cuenta siguiente ya no se intenta: la IP esta bloqueada
        mvc.perform(post("/auth/login").with(desdeIp).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"spray-otra\",\"password\":\"Verano2026\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));

        // desde otra IP, esa misma cuenta sigue pudiendo intentarlo
        mvc.perform(post("/auth/login").with(peticion -> {
                            peticion.setRemoteAddr("198.51.100.23");
                            return peticion;
                        }).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"spray-otra\",\"password\":\"Verano2026\"}"))
                .andExpect(status().isUnauthorized());
    }
}
