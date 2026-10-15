package com.daw2.barhub.model.dto;

import com.daw2.barhub.auth.models.TipoVivienda;
import com.daw2.barhub.auth.models.User;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsuarioDto {
    private Long id;
    @Getter
    private String username;
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private List<RoleDto> roles;

    private String nombre;
    private String apellido1;
    private String apellido2;
    private String telefono;
    private String calle;
    private String tipoVivienda;
    private String portalNum;
    private String pisoNum;
    private String puerta;
    private String urbanizacionNombre;
    private String casaNum;
    private String codigoPostal;
    private String instruccionesEntrega;
    private String imagen;

    public static UsuarioDto from(User user) {
        UsuarioDto dto = new UsuarioDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());

        dto.setNombre(user.getNombre());
        dto.setApellido1(user.getApellido1());
        dto.setApellido2(user.getApellido2());
        dto.setTelefono(user.getTelefono());
        dto.setCalle(user.getCalle());

        dto.setTipoVivienda(user.getTipoVivienda() != null ? user.getTipoVivienda().name().toLowerCase() : "piso");
        dto.setPortalNum(user.getPortalNum());
        dto.setPisoNum(user.getPisoNum());
        dto.setPuerta(user.getPuerta());
        dto.setUrbanizacionNombre(user.getUrbanizacionNombre());
        dto.setCasaNum(user.getCasaNum());
        dto.setCodigoPostal(user.getCodigoPostal());
        dto.setInstruccionesEntrega(user.getInstruccionesEntrega());
        dto.setImagen(user.getImagen());

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

        user.setNombre(this.nombre);
        user.setApellido1(this.apellido1);
        user.setApellido2(this.apellido2);
        user.setTelefono(this.telefono);
        user.setCalle(this.calle);

        if (this.tipoVivienda != null && !this.tipoVivienda.isBlank()) {
            try {
                user.setTipoVivienda(TipoVivienda.valueOf(this.tipoVivienda.trim().toUpperCase()));
            } catch (Exception e) {
                user.setTipoVivienda(TipoVivienda.casa);
            }
        }

        user.setPortalNum(this.portalNum);
        user.setPisoNum(this.pisoNum);
        user.setPuerta(this.puerta);
        user.setUrbanizacionNombre(this.urbanizacionNombre);
        user.setCasaNum(this.casaNum);
        user.setCodigoPostal(this.codigoPostal);
        user.setInstruccionesEntrega(this.instruccionesEntrega);
        user.setImagen(this.imagen);

        return user;
    }
}