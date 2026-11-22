package com.daw2.barhub.auth.services.impl;

import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.model.dto.RoleDto;
import com.daw2.barhub.model.dto.UsuarioDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Alta de usuarios desde el panel de administracion. */
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private UserServiceImpl servicio;

    @BeforeEach
    void preparar() {
        servicio = new UserServiceImpl(userRepository);
        ReflectionTestUtils.setField(servicio, "roleRepository", roleRepository);
        ReflectionTestUtils.setField(servicio, "passwordEncoder", encoder);
        lenient().when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        // Role se compara solo por id: cada rol simulado lleva el suyo, como en la base de datos
        lenient().when(roleRepository.findByName(any(RoleEnum.class))).thenAnswer(i -> {
            RoleEnum nombre = i.getArgument(0);
            return Optional.of(Role.builder().id((long) nombre.ordinal() + 1).name(nombre).build());
        });
    }

    private static UsuarioDto alta(String username, String password, String... roles) {
        UsuarioDto d = new UsuarioDto();
        d.setUsername(username);
        d.setEmail(username + "@example.com");
        d.setPassword(password);
        d.setNombre("Prueba");
        d.setApellido1("Tests");
        d.setRoles(java.util.Arrays.stream(roles).map(r -> {
            RoleDto rol = new RoleDto();
            rol.setNombre(r);
            return rol;
        }).toList());
        return d;
    }

    @Test
    void laContrasenaSeGuardaConBcryptYNuncaEnClaro() {
        User guardado = servicio.crearUsuario(alta("ana", "Secreto123", "ROLE_EMPLEADO"));

        assertNotEquals("Secreto123", guardado.getPassword());
        assertTrue(guardado.getPassword().startsWith("$2"));
        assertTrue(encoder.matches("Secreto123", guardado.getPassword()));
    }

    @Test
    void recibeLosRolesIndicados() {
        User guardado = servicio.crearUsuario(alta("ana", "Secreto123", "ROLE_EMPLEADO", "ROLE_ADMIN"));

        assertEquals(2, guardado.getRoles().size());
        assertTrue(guardado.getRoles().stream().anyMatch(r -> r.getName() == RoleEnum.ROLE_EMPLEADO));
    }

    @Test
    void sinRolesEsCliente() {
        User guardado = servicio.crearUsuario(alta("ana", "Secreto123"));

        assertEquals(List.of(RoleEnum.ROLE_CLIENTE), guardado.getRoles().stream().map(Role::getName).toList());
    }

    @Test
    void unIdEnLaPeticionNoSobrescribeOtraCuenta() {
        UsuarioDto datos = alta("ana", "Secreto123");
        datos.setId(1L);

        assertNull(servicio.crearUsuario(datos).getId());
    }

    @Test
    void sinNombreDeUsuarioOSinContrasenaNoSeCrea() {
        assertThrows(IllegalArgumentException.class, () -> servicio.crearUsuario(alta(" ", "Secreto123")));
        assertThrows(IllegalArgumentException.class, () -> servicio.crearUsuario(alta("ana", "")));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void unUsuarioOEmailRepetidoNoSeCrea() {
        when(userRepository.existsByUsername("ana")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> servicio.crearUsuario(alta("ana", "Secreto123")));

        when(userRepository.existsByUsername("luis")).thenReturn(false);
        when(userRepository.existsByEmail("luis@example.com")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> servicio.crearUsuario(alta("luis", "Secreto123")));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void unRolQueNoExisteSeRechaza() {
        assertThrows(IllegalArgumentException.class,
                () -> servicio.crearUsuario(alta("ana", "Secreto123", "ROLE_INVENTADO")));
    }
}
