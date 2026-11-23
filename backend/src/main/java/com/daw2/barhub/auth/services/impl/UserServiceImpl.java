package com.daw2.barhub.auth.services.impl;

import com.daw2.barhub.auth.dosfactores.DosFactoresService;
import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.models.RoleEnum;
import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.auth.repository.RoleRepository;
import com.daw2.barhub.auth.repository.UserRepository;
import com.daw2.barhub.auth.services.UserService;
import com.daw2.barhub.model.dto.UsuarioDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private DosFactoresService dosFactores;

    @Autowired
    public UserServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> findAll() {
        return userRepository.findAll();
    }

    @Override
    @Transactional
    public User save(User user) {
        return userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public User findById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        userRepository.deleteById(id);
        // Sin claves ajenas hacia users: su verificacion en dos pasos se borra a mano
        dosFactores.desactivar(id);
    }

    /**
     * Alta de un usuario por un administrador. La contrasena se guarda con BCrypt, como en el registro;
     * sin roles, el usuario es cliente. Lanza IllegalArgumentException si faltan datos o ya existen.
     */
    @Transactional
    public User crearUsuario(UsuarioDto usuarioDto) {
        if (usuarioDto.getUsername() == null || usuarioDto.getUsername().isBlank()) {
            throw new IllegalArgumentException("El nombre de usuario es obligatorio");
        }
        if (usuarioDto.getPassword() == null || usuarioDto.getPassword().isBlank()) {
            throw new IllegalArgumentException("La contraseña es obligatoria");
        }
        if (Boolean.TRUE.equals(userRepository.existsByUsername(usuarioDto.getUsername()))) {
            throw new IllegalArgumentException("Ese nombre de usuario ya existe");
        }
        if (usuarioDto.getEmail() != null && !usuarioDto.getEmail().isBlank()
                && Boolean.TRUE.equals(userRepository.existsByEmail(usuarioDto.getEmail()))) {
            throw new IllegalArgumentException("Ese email ya está en uso");
        }

        User user = usuarioDto.to();
        // Siempre un usuario nuevo: un id en la peticion no puede sobrescribir otra cuenta
        user.setId(null);
        user.setPassword(passwordEncoder.encode(usuarioDto.getPassword()));
        // El administrador da de alta al personal con un correo conocido: no hace falta confirmarlo
        user.setEmailVerificado(true);

        Set<Role> roles;
        if (usuarioDto.getRoles() != null && !usuarioDto.getRoles().isEmpty()) {
            roles = usuarioDto.getRoles().stream()
                    .map(rol -> roleRepository.findByName(RoleEnum.valueOf(rol.getNombre()))
                            .orElseThrow(() -> new IllegalArgumentException("Rol no encontrado: " + rol.getNombre())))
                    .collect(Collectors.toSet());
        } else {
            roles = Set.of(roleRepository.findByName(RoleEnum.ROLE_CLIENTE)
                    .orElseThrow(() -> new IllegalStateException("Rol ROLE_CLIENTE no encontrado")));
        }
        user.setRoles(new HashSet<>(roles));

        return userRepository.save(user);
    }
}