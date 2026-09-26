package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.Role;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class RoleDto {
    private Long id;

    @JsonProperty("nombre")
    private String nombre;

    public static RoleDto from(Role role) {
        RoleDto dto = null;
        if (role != null) {
            dto = new RoleDto();
            dto.setId(role.getId());
            dto.setNombre(role.getName().name());
        }
        return dto;
    }

    public static List<RoleDto> from(List<Role> roles) {
        List<RoleDto> dtos = new ArrayList<>();
        if (roles != null) {
            for (Role role : roles) {
                dtos.add(from(role));
            }
        }
        return dtos;
    }
}
