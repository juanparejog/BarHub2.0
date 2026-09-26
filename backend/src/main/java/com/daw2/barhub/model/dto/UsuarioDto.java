package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioDto {
    private Long id;
    private String username;
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private List<RoleDto> roles;

    public static UsuarioDto from(User user) {
        UsuarioDto dto = new UsuarioDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());

        dto.setRoles(user.getRoles().stream().map(RoleDto::from).collect(Collectors.toList()));

        return dto;
    }

    public static List<UsuarioDto> from(List<User> users) {
        return users.stream()
                .map(UsuarioDto::from)
                .collect(Collectors.toList());
    }

    public User to() {
        User user = new User();
        user.setId(this.id);
        user.setUsername(this.username);
        user.setEmail(this.email);
        user.setPassword(this.password);

        return user;
    }

    public @NotBlank @Size(max = 20) String getUsername() {
        return this.username;
    }
}