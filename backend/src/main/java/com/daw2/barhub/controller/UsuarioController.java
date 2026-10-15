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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@CrossOrigin(origins = "http://localhost:4200")
@Slf4j
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RoleRepository roleRepository;

    private final String UPLOAD_DIR = "../frontend/src/assets/images/usuarios/";

    @Autowired
    public UsuarioController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/")
    public ResponseEntity<?> index() {
        try {
            List<User> usuarios = userService.findAll();
            return ResponseEntity.ok(UsuarioDto.from(usuarios));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al obtener usuarios: " + e.getMessage()));
        }
    }

    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody UsuarioDto usuarioDto) {
        try {
            User usuarioGuardado = userService.crearUsuario(usuarioDto);
            return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioDto.from(usuarioGuardado));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al crear usuario: " + e.getMessage()));
        }
    }

    @GetMapping("{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            User usuario = userService.findById(id);
            if (usuario == null) {
                throw new RuntimeException("Usuario no encontrado");
            }
            return ResponseEntity.ok(UsuarioDto.from(usuario));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorDto.from(e.getMessage()));
        }
    }

    @PutMapping(value = "/{id}", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    @Transactional
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestPart("usuario") UsuarioDto usuarioDto,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        try {
            User usuarioExistente = userService.findById(id);
            if (usuarioExistente == null) {
                throw new RuntimeException("Usuario no encontrado");
            }

            if (file != null && !file.isEmpty()) {
                String nombreImagen = guardarImagenEnDisco(file, usuarioDto.getUsername());
                usuarioExistente.setImagen(nombreImagen);
            }

            usuarioExistente.setUsername(usuarioDto.getUsername());
            usuarioExistente.setEmail(usuarioDto.getEmail());
            usuarioExistente.setNombre(usuarioDto.getNombre());
            usuarioExistente.setApellido1(usuarioDto.getApellido1());
            usuarioExistente.setApellido2(usuarioDto.getApellido2());
            usuarioExistente.setTelefono(usuarioDto.getTelefono());
            usuarioExistente.setCalle(usuarioDto.getCalle());

            if (usuarioDto.getTipoVivienda() != null) {
                try {
                    usuarioExistente.setTipoVivienda(TipoVivienda.valueOf(usuarioDto.getTipoVivienda().toLowerCase()));
                } catch (Exception e) {
                }
            }

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

            if (usuarioDto.getRoles() != null) {
                usuarioExistente.getRoles().clear();
                Set<Role> rolesPersistidos = usuarioDto.getRoles().stream()
                        .map(rolDto -> roleRepository.findById(rolDto.getId())
                                .orElseThrow(() -> new RuntimeException("Rol no encontrado con ID: " + rolDto.getId())))
                        .collect(Collectors.toSet());
                usuarioExistente.getRoles().addAll(rolesPersistidos);
            }

            User usuarioActualizado = userService.save(usuarioExistente);
            return ResponseEntity.ok(UsuarioDto.from(usuarioActualizado));
        } catch (Exception e) {
            log.error("Error al actualizar usuario: ", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ErrorDto.from("Error al actualizar usuario: " + e.getMessage()));
        }
    }

    @DeleteMapping("{id}")
    public ResponseEntity<?> deleteUsuario(@PathVariable Long id) {
        try {
            userService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error al eliminar usuario: " + e.getMessage()));
        }
    }

    private String guardarImagenEnDisco(MultipartFile file, String nombreUsuario) throws IOException {
        if (nombreUsuario == null || nombreUsuario.isBlank()) {
            nombreUsuario = "usuario";
        }

        String nombreLimpio = Normalizer.normalize(nombreUsuario.toLowerCase().trim(), Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .replaceAll("[^a-z0-9]", "-")
                .replaceAll("-+", "-");

        String originalFilename = file.getOriginalFilename();
        String extension = "jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".") + 1);
        }

        String nombreFinal = nombreLimpio + "." + extension;

        Path uploadPath = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        Path filePath = uploadPath.resolve(nombreFinal);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        return nombreFinal;
    }
}