package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.TipoVivienda;
import com.daw2.barhub.auth.models.User;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UsuarioDtoTest {

    private User usuarioCompleto() {
        User u = new User();
        u.setId(7L);
        u.setUsername("ana");
        u.setEmail("ana@correo.es");
        u.setNombre("Ana");
        u.setApellido1("Lopez");
        u.setApellido2("Ruiz");
        u.setTelefono("600123456");
        u.setCalle("Calle Mayor");
        u.setTipoVivienda(TipoVivienda.URBANIZACION);
        u.setPortalNum("2");
        u.setPisoNum("3");
        u.setPuerta("B");
        u.setUrbanizacionNombre("Los Pinos");
        u.setCasaNum("12");
        u.setCodigoPostal("06001");
        u.setInstruccionesEntrega("Llamar al timbre");
        u.setImagen("ana.jpg");
        u.setRoles(new HashSet<>());
        return u;
    }

    @Test
    void from_copia_los_datos_del_usuario() {
        UsuarioDto d = UsuarioDto.from(usuarioCompleto());
        assertEquals(7L, d.getId());
        assertEquals("ana", d.getUsername());
        assertEquals("ana@correo.es", d.getEmail());
        assertEquals("Lopez", d.getApellido1());
        assertEquals("urbanizacion", d.getTipoVivienda());
        assertEquals("Los Pinos", d.getUrbanizacionNombre());
        assertEquals("ana.jpg", d.getImagen());
        assertTrue(d.getRoles().isEmpty());
    }

    @Test
    void from_usa_piso_si_el_usuario_no_tiene_tipo_de_vivienda() {
        User u = usuarioCompleto();
        u.setTipoVivienda(null);
        assertEquals("piso", UsuarioDto.from(u).getTipoVivienda());
    }

    @Test
    void from_convierte_una_lista() {
        List<UsuarioDto> lista = UsuarioDto.from(List.of(usuarioCompleto(), usuarioCompleto()));
        assertEquals(2, lista.size());
    }

    @Test
    void to_vuelve_a_crear_el_usuario() {
        UsuarioDto d = UsuarioDto.from(usuarioCompleto());
        d.setPassword("clave123");
        User u = d.to();
        assertEquals("ana", u.getUsername());
        assertEquals("clave123", u.getPassword());
        assertEquals(TipoVivienda.URBANIZACION, u.getTipoVivienda());
        assertEquals("06001", u.getCodigoPostal());
        assertEquals("Llamar al timbre", u.getInstruccionesEntrega());
    }

    @Test
    void to_acepta_el_tipo_con_mayusculas_y_espacios() {
        UsuarioDto d = new UsuarioDto();
        d.setTipoVivienda("  Piso ");
        assertEquals(TipoVivienda.PISO, d.to().getTipoVivienda());
    }

    @Test
    void to_usa_casa_si_el_tipo_no_es_valido() {
        UsuarioDto d = new UsuarioDto();
        d.setTipoVivienda("castillo");
        assertEquals(TipoVivienda.CASA, d.to().getTipoVivienda());
    }
}
