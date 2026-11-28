package com.daw2.barhub.controller;

import com.daw2.barhub.auditoria.AccionAuditoria;
import com.daw2.barhub.auditoria.Auditar;
import com.daw2.barhub.auditoria.Auditoria;
import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.reautenticacion.RequiereReautenticacion;
import com.daw2.barhub.auth.services.UserService;
import com.daw2.barhub.auth.sesion.SesionService;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.UsuarioDto;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.TipoVivienda;
import com.daw2.barhub.auth.repository.RoleRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private static final String USUARIO_NO_ENCONTRADO = "Usuario no encontrado";
    private static final Set<String> EXTENSIONES_PERMITIDAS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Pattern NOMBRE_IMAGEN_VALIDO =
            Pattern.compile("^[a-z0-9](?:[a-z0-9_-]|\\.(?!(?:jpg|jpeg|png|webp)$)){0,100}\\.(?:jpg|jpeg|png|webp)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_VALIDO = Pattern.compile("^[^@\\s]+@[^@\\s.]+\\.[^@\\s]+$");

    private final UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private DosFactoresService dosFactores;

    @Autowired
    private SesionService sesionService;

    @Value("${app.upload.usuarios:../frontend/src/assets/images/usuarios/}")
    private String uploadDir;

    @Autowired
    public UsuarioController(UserService userService) {
        this.userService = userService;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/")
    public ResponseEntity<?> index() {
        try {
            List<User> usuarios = userService.findAll();
            List<UsuarioDto> dtos = UsuarioDto.from(usuarios);
            Set<Long> conDosFactores = dosFactores.usuariosConActiva();
            dtos.forEach(dto -> dto.setDosFactores(conDosFactores.contains(dto.getId())));
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            log.error("Error al obtener usuarios", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al obtener usuarios"));
        }
    }

    /** Alta desde el panel: datos en la parte "usuario" (JSON) y foto opcional en "file", como al editar. */
    @PreAuthorize("hasRole('ADMIN')")
    @RequiereReautenticacion
    @Auditar(AccionAuditoria.USUARIO_CREADO)
    @PostMapping(value = "/", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public ResponseEntity<?> create(
            @RequestPart("usuario") UsuarioDto usuarioDto,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        Path subido = null;
        try {
            String error = validarPerfil(usuarioDto, true);
            if (error != null) {
                return ResponseEntity.badRequest().body(ErrorDto.from(error));
            }
            User usuarioGuardado = userService.crearUsuario(usuarioDto);
            Auditoria.objetivo(objetivo(usuarioGuardado));
            Auditoria.detalle("Roles: " + nombresRoles(usuarioGuardado));
            if (file != null && !file.isEmpty()) {
                String nombreImagen = guardarImagenEnDisco(file, usuarioGuardado.getId());
                subido = carpeta().resolve(nombreImagen);
                usuarioGuardado.setImagen(nombreImagen);
                usuarioGuardado = userService.save(usuarioGuardado);
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioDto.from(usuarioGuardado));
        } catch (IllegalArgumentException e) {
            borrarFichero(subido);
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        } catch (Exception e) {
            log.error("Error al crear usuario", e);
            borrarFichero(subido);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al crear usuario"));
        }
    }

    @GetMapping("{id}")
    public ResponseEntity<?> show(@PathVariable Long id, Authentication auth) {
        User usuario = userService.findById(id);
        if (usuario == null || !puedeAccederA(usuario, auth)) {
            // mismo 404 en ambos casos: no revelamos si el id existe
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorDto.from(USUARIO_NO_ENCONTRADO));
        }
        return ResponseEntity.ok(UsuarioDto.from(usuario));
    }

    // Editar su propio perfil no la exige; editar el de otro (datos, contrasena o roles), si
    @RequiereReautenticacion(soloSobreOtroUsuario = true)
    @Auditar(AccionAuditoria.USUARIO_EDITADO)
    @PutMapping(value = "/{id}", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    @Transactional
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestPart("usuario") UsuarioDto usuarioDto,
            @RequestPart(value = "file", required = false) MultipartFile file,
            Authentication auth) {
        Path subido = null;
        try {
            User usuarioExistente = userService.findById(id);
            if (usuarioExistente == null || !puedeAccederA(usuarioExistente, auth)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ErrorDto.from(USUARIO_NO_ENCONTRADO));
            }
            boolean admin = esAdmin(auth);
            Auditoria.objetivo(objetivo(usuarioExistente));
            String rolesAntes = nombresRoles(usuarioExistente);

            String error = validarPerfil(usuarioDto, admin);
            if (error == null) {
                error = validarCambioPassword(usuarioExistente, usuarioDto, auth, admin);
            }
            if (error != null) {
                return ResponseEntity.badRequest().body(ErrorDto.from(error));
            }

            String imagenAnterior = usuarioExistente.getImagen();
            if (file != null && !file.isEmpty()) {
                String nombreImagen = guardarImagenEnDisco(file, usuarioExistente.getId());
                subido = carpeta().resolve(nombreImagen);
                usuarioExistente.setImagen(nombreImagen);
            }

            aplicarDatosPerfil(usuarioExistente, usuarioDto, admin);

            if (hayPassword(usuarioDto)) {
                usuarioExistente.setPassword(passwordEncoder.encode(usuarioDto.getPassword()));
            }
            if (admin && usuarioDto.getRoles() != null) {
                actualizarRoles(usuarioExistente, usuarioDto);
            }

            User usuarioActualizado = userService.save(usuarioExistente);
            Auditoria.detalle(detalleDelCambio(hayPassword(usuarioDto), rolesAntes, nombresRoles(usuarioActualizado)));
            if (hayPassword(usuarioDto)) {
                cerrarSesionesTrasCambioDeClave(id, usuarioExistente, auth);
            }
            if (subido != null) {
                borrarImagenSiYaNoSeUsa(imagenAnterior, usuarioActualizado.getImagen());
            }
            return ResponseEntity.ok(UsuarioDto.from(usuarioActualizado));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        } catch (Exception e) {
            log.error("Error al actualizar usuario", e);
            borrarFichero(subido);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ErrorDto.from("No se pudo actualizar el usuario"));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @RequiereReautenticacion
    @Auditar(AccionAuditoria.USUARIO_BORRADO)
    @DeleteMapping("{id}")
    public ResponseEntity<?> deleteUsuario(@PathVariable Long id) {
        try {
            User usuario = userService.findById(id);
            if (usuario != null) {
                Auditoria.objetivo(objetivo(usuario));
            }
            String imagen = usuario != null ? usuario.getImagen() : null;
            userService.delete(id);
            borrarImagen(imagen);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error al eliminar usuario", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al eliminar usuario"));
        }
    }

    /**
     * Quita la verificacion en dos pasos de un empleado que ha perdido el movil y sus codigos de
     * recuperacion, y cierra sus sesiones: en su siguiente inicio de sesion la configura de nuevo.
     * La propia no: se gestiona desde el perfil.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @RequiereReautenticacion
    @Auditar(AccionAuditoria.DOS_FACTORES_RESTABLECIDA)
    @DeleteMapping("{id}/dos-factores")
    public ResponseEntity<?> restablecerDosFactores(@PathVariable Long id, Authentication auth) {
        User usuario = userService.findById(id);
        if (usuario == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from(USUARIO_NO_ENCONTRADO));
        }
        Auditoria.objetivo(objetivo(usuario));
        if (usuario.getUsername().equals(auth.getName())) {
            return ResponseEntity.badRequest()
                    .body(ErrorDto.from("Tu propia verificación en dos pasos no se puede quitar desde aquí."));
        }
        dosFactores.desactivar(id);
        sesionService.cerrarTodas(id, SesionService.MOTIVO_DOS_FACTORES);
        log.warn("{} ha restablecido la verificación en dos pasos de {}", auth.getName(), usuario.getUsername());
        return ResponseEntity.noContent().build();
    }

    // ---------- auxiliares ----------

    /** Como aparece el usuario afectado en el registro de auditoria. */
    /** Lo que se apunta en la auditoría: la contraseña cambiada y los roles de antes y de después. */
    static String detalleDelCambio(boolean conClave, String rolesAntes, String rolesDespues) {
        List<String> cambios = new ArrayList<>();
        if (conClave) {
            cambios.add("contraseña cambiada");
        }
        if (!rolesAntes.equals(rolesDespues)) {
            cambios.add("roles: " + rolesAntes + " -> " + rolesDespues);
        }
        return cambios.isEmpty() ? "Datos del perfil" : String.join("; ", cambios);
    }

    /**
     * Con la contraseña cambiada, las sesiones abiertas con la anterior se cierran: todas si el
     * administrador se la cambia a otro; si la cambia el propio usuario, todas menos esta.
     */
    private void cerrarSesionesTrasCambioDeClave(Long id, User usuario, Authentication auth) {
        boolean propia = usuario.getUsername().equals(auth.getName());
        sesionService.cerrarOtras(id, propia ? sesionActual() : null, SesionService.MOTIVO_CAMBIO_CLAVE);
    }

    /** La foto anterior ya no se usa: se borra para no dejar ficheros huérfanos. */
    private void borrarImagenSiYaNoSeUsa(String anterior, String actual) {
        if (anterior != null && !anterior.equals(actual)) {
            borrarImagen(anterior);
        }
    }

    private static String objetivo(User usuario) {
        return usuario == null ? null : "usuario " + usuario.getId() + " (" + usuario.getUsername() + ")";
    }

    private static String nombreRol(Role rol) {
        return rol.getName() == null ? "?" : rol.getName().name().replace("ROLE_", "");
    }

    private static String nombresRoles(User usuario) {
        return usuario == null || usuario.getRoles() == null ? "" : usuario.getRoles().stream()
                .map(UsuarioController::nombreRol)
                .sorted()
                .collect(Collectors.joining(", "));
    }

    private boolean esAdmin(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private boolean puedeAccederA(User usuario, Authentication auth) {
        return esAdmin(auth) || usuario.getUsername().equals(auth.getName());
    }

    /** Devuelve el mensaje de error, o null si los datos son validos (evita 500 por validacion en el commit). */
    private String validarPerfil(UsuarioDto d, boolean admin) {
        if (d.getNombre() == null || d.getNombre().isBlank()
                || d.getApellido1() == null || d.getApellido1().isBlank()) {
            return "Nombre y primer apellido son obligatorios";
        }
        if (d.getNombre().length() > 20 || d.getApellido1().length() > 20
                || (d.getApellido2() != null && d.getApellido2().length() > 20)) {
            return "Nombre y apellidos: maximo 20 caracteres";
        }
        if (d.getEmail() != null && !d.getEmail().isBlank()
                && (d.getEmail().length() > 50 || !EMAIL_VALIDO.matcher(d.getEmail()).matches())) {
            return "Email no valido";
        }
        if (hayPassword(d) && (d.getPassword().length() < 6 || d.getPassword().length() > 40)) {
            return "La contrasena debe tener entre 6 y 40 caracteres";
        }
        if (admin && d.getUsername() != null && !d.getUsername().isBlank()
                && (d.getUsername().length() < 3 || d.getUsername().length() > 20)) {
            return "El nombre de usuario debe tener entre 3 y 20 caracteres";
        }
        return null;
    }

    private boolean hayPassword(UsuarioDto d) {
        return d.getPassword() != null && !d.getPassword().isBlank();
    }

    /**
     * Quien cambia su propia contrasena tiene que demostrar que conoce la actual.
     * Un admin que cambia la de otra persona (recuperacion de cuenta) no la necesita.
     * Devuelve el mensaje de error, o null si los datos son correctos.
     */
    private String validarCambioPassword(User existente, UsuarioDto d, Authentication auth, boolean admin) {
        if (!hayPassword(d)) {
            return null;
        }
        boolean cambiaLaPropia = existente.getUsername().equals(auth.getName());
        if (admin && !cambiaLaPropia) {
            return null;
        }
        String actual = d.getPasswordActual();
        if (actual == null || actual.isBlank()) {
            return "Indica tu contrasena actual para cambiarla";
        }
        if (!passwordEncoder.matches(actual, existente.getPassword())) {
            return "La contrasena actual no es correcta";
        }
        return null;
    }

    private void aplicarDatosPerfil(User u, UsuarioDto d, boolean admin) {
        // Solo un admin puede cambiar el username, el correo y los roles. El usuario cambia su
        // correo con un enlace de confirmacion, no aqui: si no, una sesion robada bastaria para
        // quedarse con la cuenta (pidiendo la recuperacion de la contrasena al correo nuevo)
        if (admin && d.getUsername() != null && !d.getUsername().isBlank()) {
            u.setUsername(d.getUsername());
        }
        if (admin && d.getEmail() != null && !d.getEmail().isBlank()) {
            u.setEmail(d.getEmail());
        }
        u.setNombre(d.getNombre());
        u.setApellido1(d.getApellido1());
        u.setApellido2(d.getApellido2());
        u.setTelefono(d.getTelefono());
        u.setCalle(d.getCalle());

        actualizarTipoVivienda(u, d);

        u.setPortalNum(d.getPortalNum());
        u.setPisoNum(d.getPisoNum());
        u.setPuerta(d.getPuerta());
        u.setUrbanizacionNombre(d.getUrbanizacionNombre());
        u.setCasaNum(d.getCasaNum());
        u.setCodigoPostal(d.getCodigoPostal());
        u.setInstruccionesEntrega(d.getInstruccionesEntrega());
    }

    private void actualizarRoles(User u, UsuarioDto d) {
        Set<Role> persistidos = d.getRoles().stream()
                .map(rolDto -> roleRepository.findById(rolDto.getId())
                        .orElseThrow(() -> new IllegalArgumentException("Rol no valido")))
                .collect(Collectors.toSet());
        u.getRoles().clear();
        u.getRoles().addAll(persistidos);
    }

    /** Id de la sesion de esta peticion (lo pone AuthTokenFilter); null fuera de una peticion. */
    private static String sesionActual() {
        RequestAttributes atributos = RequestContextHolder.getRequestAttributes();
        return atributos == null ? null
                : (String) atributos.getAttribute(SesionService.ATRIBUTO_SESION, RequestAttributes.SCOPE_REQUEST);
    }

    private Path carpeta() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    private String guardarImagenEnDisco(MultipartFile file, Long idUsuario) throws IOException {
        String original = file.getOriginalFilename();
        String extension = (original != null && original.contains("."))
                ? original.substring(original.lastIndexOf('.') + 1).toLowerCase()
                : "";
        String tipo = file.getContentType();
        if (!EXTENSIONES_PERMITIDAS.contains(extension) || tipo == null || !tipo.startsWith("image/")) {
            throw new IllegalArgumentException("Formato de imagen no permitido (jpg, png o webp)");
        }

        byte[] cabecera;
        try (InputStream in = file.getInputStream()) {
            cabecera = in.readNBytes(12);
        }
        if (!cabeceraCoincide(cabecera, extension)) {
            throw new IllegalArgumentException("El archivo no es una imagen valida");
        }

        // Sufijo aleatorio: no se pisan ficheros ni se sirve una foto antigua desde cache
        String nombreFinal = "usuario-" + idUsuario + "-" + UUID.randomUUID().toString().substring(0, 8)
                + "." + extension;
        Path carpeta = carpeta();
        Files.createDirectories(carpeta);

        Path destino = carpeta.resolve(nombreFinal).normalize();
        if (!destino.startsWith(carpeta)) {
            throw new IllegalArgumentException("Nombre de archivo no valido");
        }
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, destino, StandardCopyOption.REPLACE_EXISTING);
        }
        return nombreFinal;
    }

    /** Borra una imagen por nombre, solo si es un nombre valido y queda dentro de la carpeta de subidas. */
    private void borrarImagen(String nombre) {
        if (nombre == null || nombre.isBlank() || !NOMBRE_IMAGEN_VALIDO.matcher(nombre).matches()) {
            return;
        }
        Path carpeta = carpeta();
        Path ruta = carpeta.resolve(nombre).normalize();
        if (ruta.startsWith(carpeta)) {
            borrarFichero(ruta);
        }
    }

    private void borrarFichero(Path ruta) {
        if (ruta == null) {
            return;
        }
        try {
            Files.deleteIfExists(ruta);
        } catch (IOException e) {
            log.warn("No se pudo borrar {}", ruta.getFileName(), e);
        }
    }

    /** Comprueba los primeros bytes (firma) del fichero segun la extension declarada. */
    private boolean cabeceraCoincide(byte[] h, String extension) {
        if (h.length < 12) {
            return false;
        }
        switch (extension) {
            case "jpg":
            case "jpeg":
                return (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "png":
                return (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "webp":
                return h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                        && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
            default:
                return false;
        }
    }

    private void actualizarTipoVivienda(User usuarioExistente, UsuarioDto usuarioDto) {
        if (usuarioDto.getTipoVivienda() != null) {
            try {
                usuarioExistente.setTipoVivienda(TipoVivienda.valueOf(usuarioDto.getTipoVivienda().toUpperCase()));
            } catch (IllegalArgumentException e) {
                log.warn("Tipo de vivienda no valido recibido: {}", usuarioDto.getTipoVivienda());
            }
        }
    }
}