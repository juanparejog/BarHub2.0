package com.daw2.barhub.auth.models;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserTest {

    private User conCalle() {
        User u = new User();
        u.setCalle("Calle Mayor");
        u.setCodigoPostal("06001");
        return u;
    }

    @Test
    void sin_calle_la_direccion_esta_vacia() {
        assertEquals("", new User().getDireccionFormateada());
    }

    @Test
    void direccion_de_un_piso() {
        User u = conCalle();
        u.setTipoVivienda(TipoVivienda.PISO);
        u.setPortalNum("2");
        u.setPisoNum("3");
        u.setPuerta("B");
        assertEquals("Calle Mayor, Portal 2, 3º, B (CP: 06001)", u.getDireccionFormateada());
    }

    @Test
    void direccion_de_una_urbanizacion() {
        User u = conCalle();
        u.setTipoVivienda(TipoVivienda.URBANIZACION);
        u.setUrbanizacionNombre("Los Pinos");
        u.setCasaNum("12");
        assertEquals("Calle Mayor, Urb. Los Pinos, Nº 12 (CP: 06001)", u.getDireccionFormateada());
    }

    @Test
    void direccion_de_una_casa() {
        User u = conCalle();
        u.setTipoVivienda(TipoVivienda.CASA);
        u.setCasaNum("12");
        assertEquals("Calle Mayor, Nº 12 (CP: 06001)", u.getDireccionFormateada());
    }

    @Test
    void sin_tipo_de_vivienda_se_trata_como_casa() {
        User u = conCalle();
        u.setCasaNum("12");
        assertEquals("Calle Mayor, Nº 12 (CP: 06001)", u.getDireccionFormateada());
    }

    @Test
    void los_datos_que_faltan_se_dejan_en_blanco() {
        User u = new User();
        u.setCalle("Calle Mayor");
        u.setTipoVivienda(TipoVivienda.PISO);
        assertEquals("Calle Mayor, Portal , º,  (CP: )", u.getDireccionFormateada());

        u.setTipoVivienda(TipoVivienda.URBANIZACION);
        assertEquals("Calle Mayor, Urb. , Nº  (CP: )", u.getDireccionFormateada());

        u.setTipoVivienda(TipoVivienda.CASA);
        assertEquals("Calle Mayor, Nº  (CP: )", u.getDireccionFormateada());
    }

    @Test
    void el_constructor_corto_y_el_builder_funcionan() {
        User a = new User("ana", "ana@correo.es", "clave");
        assertEquals("ana", a.getUsername());
        assertEquals("ana@correo.es", a.getEmail());
        assertEquals("clave", a.getPassword());

        User b = User.builder().username("luis").build();
        assertEquals("luis", b.getUsername());
        assertTrue(b.getRoles().isEmpty());
        assertTrue(b.getPedidos().isEmpty());
    }
}
