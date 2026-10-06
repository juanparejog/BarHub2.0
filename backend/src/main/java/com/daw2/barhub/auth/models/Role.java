package com.daw2.barhub.auth.models;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "roles")
public class Role {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @EqualsAndHashCode.Include
  private Long id;

  @Enumerated(EnumType.STRING)
  @Column(length = 20)
  private RoleEnum name;
  @CreationTimestamp
  private Instant createdAt;
  @UpdateTimestamp
  private Instant updatedAt;

 }
