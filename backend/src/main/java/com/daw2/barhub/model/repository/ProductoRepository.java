package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.entity.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
    Producto findById(long id);
}