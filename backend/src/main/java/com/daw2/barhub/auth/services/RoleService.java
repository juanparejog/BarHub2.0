package com.daw2.barhub.auth.services;

import com.daw2.barhub.auth.models.Role;
import com.daw2.barhub.auth.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RoleService {

    @Autowired
    private RoleRepository roleRepository;

    public Role save(Role role) {
        return roleRepository.save(role);
    }

    public List<Role> findAll() {
        return roleRepository.findAll();
    }

    public Role findById(long id) {
        Optional<Role> roleOpt = roleRepository.findById(id);
        return roleOpt.orElse(null);
    }

    public void delete(long id) {
        roleRepository.deleteById(id);
    }

    public Role update(long id, Role entity) {
        Optional<Role> roleOpt = roleRepository.findById(id);
        if (roleOpt.isPresent()) {
            Role roleExistente = roleOpt.get();
            if (entity.getName() != null) roleExistente.setName(entity.getName());
            // Añade aquí otros campos si tu entidad Role tiene más atributos
            return roleRepository.save(roleExistente);
        } else {
            return null;
        }
    }
}