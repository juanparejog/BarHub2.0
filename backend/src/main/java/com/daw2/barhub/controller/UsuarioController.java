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
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private static final Set<String> EXTENSIONES_PERMITIDAS = Set.of("jpg", "jpeg", "png", "webp");

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
        try {
            User usuarioExistente = userService.findById(id);
            if (usuarioExistente == null || !puedeAccederA(usuarioExistente, auth)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ErrorDto.from("Usuario no encontrado"));
            }
            boolean admin = esAdmin(auth);

            if (usuarioDto.getNombre() == null || usuarioDto.getNombre().isBlank()
                    || usuarioDto.getApellido1() == null || usuarioDto.getApellido1().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(ErrorDto.from("Nombre y primer apellido son obligatorios"));
            }

            if (file != null && !file.isEmpty()) {
                usuarioExistente.setImagen(guardarImagenEnDisco(file, usuarioExistente.getId()));
            }

            // Solo un admin puede cambiar el username y los roles
            if (admin && usuarioDto.getUsername() != null && !usuarioDto.getUsername().isBlank()) {
                usuarioExistente.setUsername(usuarioDto.getUsername());
            }
            usuarioExistente.setEmail(usuarioDto.getEmail());
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
            return ResponseEntity.ok(UsuarioDto.from(usuarioActualizado));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        } catch (Exception e) {
            log.error("Error al actualizar usuario", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ErrorDto.from("No se pudo actualizar el usuario"));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("{id}")
    public ResponseEntity<?> deleteUsuario(@PathVariable Long id) {
        try {
            userService.delete(id);
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

    private String guardarImagenEnDisco(MultipartFile file, Long idUsuario) throws IOException {
        String original = file.getOriginalFilename();
        String extension = (original != null && original.contains("."))
                ? original.substring(original.lastIndexOf('.') + 1).toLowerCase()
                : "";
        String tipo = file.getContentType();
        if (!EXTENSIONES_PERMITIDAS.contains(extension) || tipo == null || !tipo.startsWith("image/")) {
            throw new IllegalArgumentException("Formato de imagen no permitido (jpg, png o webp)");
        }

        String nombreFinal = "usuario-" + idUsuario + "." + extension;
        Path carpeta = Paths.get(uploadDir).toAbsolutePath().normalize();
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