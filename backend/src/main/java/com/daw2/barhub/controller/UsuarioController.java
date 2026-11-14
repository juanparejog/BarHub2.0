package com.daw2.barhub.controller;

import com.daw2.barhub.auth.services.UserService;
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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private static final Set<String> EXTENSIONES_PERMITIDAS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Pattern NOMBRE_IMAGEN_VALIDO =
            Pattern.compile("^[a-z0-9][a-z0-9._-]{0,100}\\.(jpg|jpeg|png|webp)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_VALIDO = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RoleRepository roleRepository;

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
            return ResponseEntity.ok(UsuarioDto.from(usuarios));
        } catch (Exception e) {
            log.error("Error al obtener usuarios", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al obtener usuarios"));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody UsuarioDto usuarioDto) {
        try {
            User usuarioGuardado = userService.crearUsuario(usuarioDto);
            return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioDto.from(usuarioGuardado));
        } catch (Exception e) {
            log.error("Error al crear usuario", e);
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
                    .body(ErrorDto.from("Usuario no encontrado"));
        }
        return ResponseEntity.ok(UsuarioDto.from(usuario));
    }

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
                        .body(ErrorDto.from("Usuario no encontrado"));
            }
            boolean admin = esAdmin(auth);

            String error = validarPerfil(usuarioDto, admin);
            if (error != null) {
                return ResponseEntity.badRequest().body(ErrorDto.from(error));
            }

            String imagenAnterior = usuarioExistente.getImagen();
            if (file != null && !file.isEmpty()) {
                String nombreImagen = guardarImagenEnDisco(file, usuarioExistente.getId());
                subido = carpeta().resolve(nombreImagen);
                usuarioExistente.setImagen(nombreImagen);
            }

            // Solo un admin puede cambiar el username y los roles
            if (admin && usuarioDto.getUsername() != null && !usuarioDto.getUsername().isBlank()) {
                usuarioExistente.setUsername(usuarioDto.getUsername());
            }
            if (usuarioDto.getEmail() != null && !usuarioDto.getEmail().isBlank()) {
                usuarioExistente.setEmail(usuarioDto.getEmail());
            }
            usuarioExistente.setNombre(usuarioDto.getNombre());
            usuarioExistente.setApellido1(usuarioDto.getApellido1());
            usuarioExistente.setApellido2(usuarioDto.getApellido2());
            usuarioExistente.setTelefono(usuarioDto.getTelefono());
            usuarioExistente.setCalle(usuarioDto.getCalle());

            actualizarTipoVivienda(usuarioExistente, usuarioDto);

            usuarioExistente.setPortalNum(usuarioDto.getPortalNum());
            usuarioExistente.setPisoNum(usuarioDto.getPisoNum());
            usuarioExistente.setPuerta(usuarioDto.getPuerta());
            usuarioExistente.setUrbanizacionNombre(usuarioDto.getUrbanizacionNombre());
            usuarioExistente.setCasaNum(usuarioDto.getCasaNum());
            usuarioExistente.setCodigoPostal(usuarioDto.getCodigoPostal());
            usuarioExistente.setInstruccionesEntrega(usuarioDto.getInstruccionesEntrega());

            if (usuarioDto.getPassword() != null && !usuarioDto.getPassword().isBlank()) {
                usuarioExistente.setPassword(passwordEncoder.encode(usuarioDto.getPassword()));
            }

            if (admin && usuarioDto.getRoles() != null) {
                usuarioExistente.getRoles().clear();
                Set<Role> rolesPersistidos = usuarioDto.getRoles().stream()
                        .map(rolDto -> roleRepository.findById(rolDto.getId())
                                .orElseThrow(() -> new IllegalArgumentException("Rol no valido")))
                        .collect(Collectors.toSet());
                usuarioExistente.getRoles().addAll(rolesPersistidos);
            }

            User usuarioActualizado = userService.save(usuarioExistente);

            // La foto anterior ya no se usa: se borra para no dejar ficheros huerfanos
            if (subido != null && imagenAnterior != null && !imagenAnterior.equals(usuarioActualizado.getImagen())) {
                borrarImagen(imagenAnterior);
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
    @DeleteMapping("{id}")
    public ResponseEntity<?> deleteUsuario(@PathVariable Long id) {
        try {
            User usuario = userService.findById(id);
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

    // ---------- auxiliares ----------

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
        if (d.getPassword() != null && !d.getPassword().isBlank()
                && (d.getPassword().length() < 6 || d.getPassword().length() > 40)) {
            return "La contrasena debe tener entre 6 y 40 caracteres";
        }
        if (admin && d.getUsername() != null && !d.getUsername().isBlank()
                && (d.getUsername().length() < 3 || d.getUsername().length() > 20)) {
            return "El nombre de usuario debe tener entre 3 y 20 caracteres";
        }
        return null;
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