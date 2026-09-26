package com.daw2.barhub.auth.repository;

import com.daw2.barhub.auth.models.User;
import com.daw2.barhub.model.entity.Pedido;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByUsername(String username);

  Boolean existsByUsername(String username);

  Boolean existsByEmail(String email);

  @Query("SELECT p FROM Pedido p LEFT JOIN FETCH p.detalles d LEFT JOIN FETCH d.producto WHERE p.user.id = :usuarioId")
  List<Pedido> findByUsuarioIdWithDetalles(@Param("usuarioId") Long usuarioId);
}
