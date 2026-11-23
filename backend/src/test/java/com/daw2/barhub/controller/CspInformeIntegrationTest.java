package com.daw2.barhub.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** El navegador envia los avisos de la CSP sin credenciales: el endpoint es publico y siempre responde 204. */
@SpringBootTest
@AutoConfigureMockMvc
class CspInformeIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void aceptaUnAvisoSinSesion() throws Exception {
        mvc.perform(post("/csp-informe").contentType("application/csp-report")
                        .content("{\"csp-report\": {\"violated-directive\": \"script-src\", \"blocked-uri\": \"inline\"}}"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/csp-informe").contentType("application/reports+json")
                        .content("[{\"type\": \"csp-violation\", \"body\": {\"effectiveDirective\": \"img-src\"}}]"))
                .andExpect(status().isNoContent());
    }

    @Test
    void unCuerpoNoValidoODemasiadoGrandeTambienResponde204() throws Exception {
        mvc.perform(post("/csp-informe").contentType("application/csp-report").content("{no es json"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/csp-informe").contentType("application/csp-report")
                        .content("x".repeat(CspInformeController.TAMANO_MAXIMO + 10)))
                .andExpect(status().isNoContent());
    }
}
