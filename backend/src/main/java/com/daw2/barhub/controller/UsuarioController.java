package com.daw2.barhub.controller;

import com.daw2.barhub.auth.services.UserService;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.UsuarioDto;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.repository.RoleRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

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
    private RoleRepository roleRepository; // Inyectamos RoleRepository para recuperar las entidades gestionadas por JPA

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

    @PutMapping("{id}")
    @Transactional // AÑADIDO: Importante para sincronizaciones de colecciones JPA
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UsuarioDto usuarioDto) {
        try {
            User usuarioExistente = userService.findById(id);
            if (usuarioExistente == null) {
                throw new RuntimeException("Usuario no encontrado");
            }

            // 1. Datos básicos
            usuarioExistente.setUsername(usuarioDto.getUsername());
            usuarioExistente.setEmail(usuarioDto.getEmail());

            if (usuarioDto.getPassword() != null && !usuarioDto.getPassword().isBlank()) {
                usuarioExistente.setPassword(passwordEncoder.encode(usuarioDto.getPassword()));
            }

            // 2. ACTUALIZACIÓN DE ROLES:
            if (usuarioDto.getRoles() != null) {
                // Limpiar la relación previa en la tabla intermedia user_roles
                usuarioExistente.getRoles().clear();

                // Recuperar las entidades Role desde la base de datos a partir de los DTOs recibidos
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
}