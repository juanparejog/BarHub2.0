package com.daw2.barhub.auth.services;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.dto.UsuarioDto;

import java.util.List;

public interface UserService {
    List<User> findAll();
    User save(User user);
    User findById(Long id);
    void delete(Long id);
    User crearUsuario(UsuarioDto usuarioDto);
}