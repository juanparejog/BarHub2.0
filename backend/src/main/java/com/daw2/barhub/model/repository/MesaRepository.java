package com.daw2.barhub.model.repository;

import com.daw2.barhub.model.entity.Mesa;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MesaRepository extends JpaRepository<Mesa, Long> {
    Mesa findById(long id);
}