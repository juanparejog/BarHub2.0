package com.daw2.barhub.auth.controllers;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

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
}
