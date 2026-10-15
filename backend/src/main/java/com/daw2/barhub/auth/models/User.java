package com.daw2.barhub.auth.models;

import com.daw2.barhub.model.entity.Pedido;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = "username"),
                @UniqueConstraint(columnNames = "email")
        })
public class User {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  public User (String username, String email, String password) {
    this.username = username;
    this.email = email;
    this.password = password;
  }

  @NotBlank
  @Size(max = 20)
  @Column(length = 50, unique = true)
  private String username;

  @NotBlank
  @Size(max = 50)
  @Email
  @Column(length = 150, unique = true)
  private String email;

  @NotBlank
  @Size(max = 120)
  @Column(length = 60)
  private String password;

  @NotBlank
  @Size(max = 20)
  @Column(length = 50)
  private String nombre;

  @NotBlank
  @Size(max = 20)
  @Column(length = 50)
  private String apellido1;

  @Size(max = 20)
  @Column(length = 50, nullable = true)
  private String apellido2;

  @Column(length = 20)
  private String telefono;

  @Column(length = 150)
  private String calle;
  @Column(length = 30)
  private TipoVivienda tipoVivienda;

  @Column(length = 20)
  private String portalNum;

  @Column(length = 20)
  private String pisoNum;

  @Column(length = 10)
  private String puerta;

  @Column(length = 100)
  private String urbanizacionNombre;

  @Column(length = 20)
  private String casaNum;

  @Column(length = 10)
  private String codigoPostal;

  @Column(columnDefinition = "TEXT")
  private String instruccionesEntrega;

  @Column(columnDefinition = "TEXT")
  private String imagen;

  @ManyToMany(fetch = FetchType.LAZY)
  @JoinTable(name = "user_roles",
          joinColumns = @JoinColumn(name = "user_id"),
          inverseJoinColumns = @JoinColumn(name = "role_id"))
  private Set<Role> roles = new HashSet<>();

  @CreationTimestamp
  private Instant createdAt;

  @UpdateTimestamp
  private Instant updatedAt;

  @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
  @JsonManagedReference
  private List<Pedido> pedidos = new ArrayList<>();
  
  public String getDireccionFormateada() {
    if (calle == null) return "";

    TipoVivienda tipo = tipoVivienda != null ? tipoVivienda : TipoVivienda.casa;

    switch (tipo) {
      case piso:
        return String.format("%s, Portal %s, %sº %s (CP: %s)",
                calle,
                portalNum != null ? portalNum : "",
                pisoNum != null ? pisoNum : "",
                puerta != null ? puerta : "",
                codigoPostal != null ? codigoPostal : "");

      case urbanizacion:
        return String.format("%s, Urb. %s, Nº %s (CP: %s)",
                calle,
                urbanizacionNombre != null ? urbanizacionNombre : "",
                casaNum != null ? casaNum : "",
                codigoPostal != null ? codigoPostal : "");

      case casa:
      default:
        return String.format("%s, Nº %s (CP: %s)",
                calle,
                casaNum != null ? casaNum : "",
                codigoPostal != null ? codigoPostal : "");
    }
  }
}