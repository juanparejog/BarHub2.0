package com.daw2.barhub.controller;

import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.models.TipoVivienda;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.services.UserService;
import com.daw2.barhub.auth.sesion.SesionService;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.UsuarioDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private DosFactoresService dosFactores;

    @Mock
    private SesionService sesionService;

    @TempDir
    Path carpeta;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private UsuarioController controller;
    private User juan;

    @BeforeEach
    void preparar() {
        controller = new UsuarioController(userService);
        ReflectionTestUtils.setField(controller, "passwordEncoder", encoder);
        ReflectionTestUtils.setField(controller, "uploadDir", carpeta.toString());
        ReflectionTestUtils.setField(controller, "dosFactores", dosFactores);
        ReflectionTestUtils.setField(controller, "sesionService", sesionService);

        juan = new User();
        juan.setId(1L);
        juan.setUsername("juan");
        juan.setPassword(encoder.encode("claveVieja1"));
        juan.setNombre("Juan");
        juan.setApellido1("Parejo");
        juan.setRoles(new HashSet<>());
    }

    // ---------- ayudas ----------

    private Authentication como(String usuario, String rol) {
        return new UsernamePasswordAuthenticationToken(usuario, null, List.of(new SimpleGrantedAuthority(rol)));
    }

    private UsuarioDto datos() {
        UsuarioDto d = new UsuarioDto();
        d.setNombre("Juan");
        d.setApellido1("Parejo");
        return d;
    }

    private void permitirGuardar() {
        lenient().when(userService.findById(1L)).thenReturn(juan);
        lenient().when(userService.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
    }

    private ResponseEntity<?> actualizar(UsuarioDto d, MultipartFile f, Authentication a) {
        return controller.update(1L, d, f, a);
    }

    private ResponseEntity<?> actualizarComoJuan(UsuarioDto d) {
        return actualizar(d, null, como("juan", "ROLE_CLIENTE"));
    }

    private MockMultipartFile imagen(String nombre, String tipo, byte[] bytes) {
        return new MockMultipartFile("file", nombre, tipo, bytes);
    }

    private static byte[] cabeceraPng() {
        return new byte[] {(byte) 0x89, 'P', 'N', 'G', 0, 0, 0, 0, 0, 0, 0, 0};
    }

    private static byte[] cabeceraJpg() {
        return new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    }

    private static byte[] cabeceraWebp() {
        return new byte[] {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};
    }

    private long ficherosEnCarpeta() throws IOException {
        try (Stream<Path> s = Files.list(carpeta)) {
            return s.count();
        }
    }

    // ---------- listado, alta, consulta y borrado ----------

    @Test
    void index_devuelve_la_lista() {
        when(userService.findAll()).thenReturn(List.of(juan));
        assertEquals(200, controller.index().getStatusCode().value());
    }

    @Test
    void index_indica_quien_tiene_la_verificacion_en_dos_pasos() {
        User ana = new User();
        ana.setId(2L);
        ana.setUsername("ana");
        ana.setRoles(new HashSet<>());
        when(userService.findAll()).thenReturn(List.of(juan, ana));
        when(dosFactores.usuariosConActiva()).thenReturn(Set.of(2L));

        List<?> cuerpo = (List<?>) controller.index().getBody();
        assertEquals(Boolean.FALSE, ((UsuarioDto) cuerpo.get(0)).getDosFactores());
        assertEquals(Boolean.TRUE, ((UsuarioDto) cuerpo.get(1)).getDosFactores());
    }

    // ---------- restablecer la verificacion en dos pasos ----------

    @Test
    void restablecer_dos_factores_la_quita_y_cierra_sus_sesiones() {
        User ana = new User();
        ana.setId(2L);
        ana.setUsername("ana");
        when(userService.findById(2L)).thenReturn(ana);

        assertEquals(204, controller.restablecerDosFactores(2L, como("juan", "ROLE_ADMIN")).getStatusCode().value());
        verify(dosFactores).desactivar(2L);
        verify(sesionService).cerrarTodas(2L, SesionService.MOTIVO_DOS_FACTORES);
    }

    @Test
    void restablecer_dos_factores_no_vale_para_la_propia_ni_para_un_usuario_que_no_existe() {
        when(userService.findById(1L)).thenReturn(juan);
        when(userService.findById(9L)).thenReturn(null);

        assertEquals(400, controller.restablecerDosFactores(1L, como("juan", "ROLE_ADMIN")).getStatusCode().value());
        assertEquals(404, controller.restablecerDosFactores(9L, como("juan", "ROLE_ADMIN")).getStatusCode().value());
        verify(dosFactores, never()).desactivar(any());
    }

    @Test
    void index_responde_500_si_falla_el_servicio() {
        when(userService.findAll()).thenThrow(new RuntimeException("boom"));
        assertEquals(500, controller.index().getStatusCode().value());
    }

    @Test
    void create_devuelve_201() {
        when(userService.crearUsuario(any(UsuarioDto.class))).thenReturn(juan);
        assertEquals(201, controller.create(datos(), null).getStatusCode().value());
    }

    @Test
    void create_con_foto_la_guarda_con_el_usuario() {
        permitirGuardar();
        when(userService.crearUsuario(any(UsuarioDto.class))).thenReturn(juan);
        MockMultipartFile foto = imagen("foto.png", "image/png", cabeceraPng());

        assertEquals(201, controller.create(datos(), foto).getStatusCode().value());
        assertTrue(juan.getImagen() != null && Files.exists(carpeta.resolve(juan.getImagen())));
    }

    @Test
    void create_con_datos_no_validos_da_400_sin_llegar_al_servicio() {
        UsuarioDto sinNombre = new UsuarioDto();
        assertEquals(400, controller.create(sinNombre, null).getStatusCode().value());
        verify(userService, never()).crearUsuario(any(UsuarioDto.class));
    }

    @Test
    void create_con_usuario_repetido_da_400_con_el_motivo() {
        when(userService.crearUsuario(any(UsuarioDto.class)))
                .thenThrow(new IllegalArgumentException("Ese nombre de usuario ya existe"));
        ResponseEntity<?> respuesta = controller.create(datos(), null);
        assertEquals(400, respuesta.getStatusCode().value());
        assertEquals("Ese nombre de usuario ya existe", ((ErrorDto) respuesta.getBody()).getMessage());
    }

    @Test
    void create_responde_500_si_falla() {
        when(userService.crearUsuario(any(UsuarioDto.class))).thenThrow(new RuntimeException("boom"));
        assertEquals(500, controller.create(datos(), null).getStatusCode().value());
    }

    @Test
    void show_devuelve_el_propio_usuario() {
        when(userService.findById(1L)).thenReturn(juan);
        assertEquals(200, controller.show(1L, como("juan", "ROLE_CLIENTE")).getStatusCode().value());
    }

    @Test
    void show_da_404_si_no_existe_o_es_de_otro() {
        when(userService.findById(1L)).thenReturn(juan);
        assertEquals(404, controller.show(1L, como("maria", "ROLE_CLIENTE")).getStatusCode().value());
        when(userService.findById(2L)).thenReturn(null);
        assertEquals(404, controller.show(2L, como("juan", "ROLE_ADMIN")).getStatusCode().value());
    }

    @Test
    void delete_borra_y_devuelve_204() {
        when(userService.findById(1L)).thenReturn(juan);
        assertEquals(204, controller.deleteUsuario(1L).getStatusCode().value());
        verify(userService).delete(1L);
    }

    @Test
    void delete_responde_500_si_falla() {
        lenient().when(userService.findById(1L)).thenReturn(juan);
        doThrow(new RuntimeException("boom")).when(userService).delete(1L);
        assertEquals(500, controller.deleteUsuario(1L).getStatusCode().value());
    }

    // ---------- actualizar: permisos y validaciones ----------

    @Test
    void update_da_404_si_el_usuario_no_existe() {
        when(userService.findById(1L)).thenReturn(null);
        assertEquals(404, actualizarComoJuan(datos()).getStatusCode().value());
    }

    @Test
    void update_rechaza_nombre_vacio() {
        when(userService.findById(1L)).thenReturn(juan);
        UsuarioDto d = datos();
        d.setNombre(" ");
        assertEquals(400, actualizarComoJuan(d).getStatusCode().value());
    }

    @Test
    void update_rechaza_nombres_demasiado_largos() {
        when(userService.findById(1L)).thenReturn(juan);
        UsuarioDto d = datos();
        d.setApellido2("x".repeat(21));
        assertEquals(400, actualizarComoJuan(d).getStatusCode().value());
    }

    @Test
    void update_rechaza_email_no_valido() {
        when(userService.findById(1L)).thenReturn(juan);
        UsuarioDto d = datos();
        d.setEmail("esto-no-es-un-email");
        assertEquals(400, actualizarComoJuan(d).getStatusCode().value());
    }

    @Test
    void update_rechaza_contrasena_demasiado_corta() {
        when(userService.findById(1L)).thenReturn(juan);
        UsuarioDto d = datos();
        d.setPassword("abc");
        d.setPasswordActual("claveVieja1");
        assertEquals(400, actualizarComoJuan(d).getStatusCode().value());
    }

    @Test
    void update_rechaza_username_corto_si_lo_cambia_un_admin() {
        when(userService.findById(1L)).thenReturn(juan);
        UsuarioDto d = datos();
        d.setUsername("ab");
        assertEquals(400, actualizar(d, null, como("admin", "ROLE_ADMIN")).getStatusCode().value());
    }

    // ---------- actualizar: datos ----------

    @Test
    void un_cliente_no_puede_cambiar_su_username() {
        permitirGuardar();
        UsuarioDto d = datos();
        d.setUsername("otro-nombre");
        d.setEmail("juan@correo.es");
        assertEquals(200, actualizarComoJuan(d).getStatusCode().value());
        assertEquals("juan", juan.getUsername());
        assertEquals("juan@correo.es", juan.getEmail());
    }

    @Test
    void un_admin_puede_cambiar_username_y_roles() {
        permitirGuardar();
        UsuarioDto d = datos();
        d.setUsername("nuevo");
        d.setRoles(new ArrayList<>());
        assertEquals(200, actualizar(d, null, como("admin", "ROLE_ADMIN")).getStatusCode().value());
        assertEquals("nuevo", juan.getUsername());
    }

    @Test
    void el_tipo_de_vivienda_se_actualiza_y_uno_invalido_se_ignora() {
        permitirGuardar();
        UsuarioDto d = datos();
        d.setTipoVivienda("casa");
        assertEquals(200, actualizarComoJuan(d).getStatusCode().value());
        assertEquals(TipoVivienda.CASA, juan.getTipoVivienda());

        d.setTipoVivienda("castillo");
        assertEquals(200, actualizarComoJuan(d).getStatusCode().value());
        assertEquals(TipoVivienda.CASA, juan.getTipoVivienda());
    }

    // ---------- actualizar: imagen ----------

    @Test
    void sube_una_imagen_png_valida() throws IOException {
        permitirGuardar();
        assertEquals(200, actualizar(datos(), imagen("foto.png", "image/png", cabeceraPng()),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
        assertTrue(juan.getImagen().startsWith("usuario-1-") && juan.getImagen().endsWith(".png"));
        assertTrue(Files.exists(carpeta.resolve(juan.getImagen())));
    }

    @Test
    void sube_imagenes_jpg_y_webp_validas() {
        permitirGuardar();
        assertEquals(200, actualizar(datos(), imagen("a.jpg", "image/jpeg", cabeceraJpg()),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
        assertEquals(200, actualizar(datos(), imagen("b.webp", "image/webp", cabeceraWebp()),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
    }

    @Test
    void al_subir_una_foto_nueva_se_borra_la_anterior() throws IOException {
        permitirGuardar();
        Path vieja = carpeta.resolve("usuario-1-abcd1234.png");
        Files.write(vieja, new byte[] {1});
        juan.setImagen("usuario-1-abcd1234.png");

        assertEquals(200, actualizar(datos(), imagen("nueva.png", "image/png", cabeceraPng()),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
        assertFalse(Files.exists(vieja));
        assertEquals(1, ficherosEnCarpeta());
    }

    @Test
    void rechaza_una_extension_no_permitida() throws IOException {
        permitirGuardar();
        assertEquals(400, actualizar(datos(), imagen("virus.exe", "application/octet-stream", cabeceraPng()),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
        assertEquals(0, ficherosEnCarpeta());
    }

    @Test
    void rechaza_un_archivo_que_dice_ser_png_pero_no_lo_es() throws IOException {
        permitirGuardar();
        assertEquals(400, actualizar(datos(), imagen("falsa.png", "image/png", new byte[12]),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
        assertEquals(0, ficherosEnCarpeta());
    }

    @Test
    void rechaza_un_archivo_demasiado_corto_para_ser_imagen() {
        permitirGuardar();
        assertEquals(400, actualizar(datos(), imagen("corta.jpg", "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8}),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
    }

    @Test
    void si_falla_el_guardado_no_se_deja_la_imagen_huerfana() throws IOException {
        lenient().when(userService.findById(1L)).thenReturn(juan);
        lenient().when(userService.save(any(User.class))).thenThrow(new RuntimeException("db caida"));
        assertEquals(400, actualizar(datos(), imagen("foto.png", "image/png", cabeceraPng()),
                como("juan", "ROLE_CLIENTE")).getStatusCode().value());
        assertEquals(0, ficherosEnCarpeta());
    }
}
