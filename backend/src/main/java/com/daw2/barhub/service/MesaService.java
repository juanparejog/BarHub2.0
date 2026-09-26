package com.daw2.barhub.service;

import com.daw2.barhub.model.entity.Mesa;

import java.util.List;

public interface MesaService {
    Mesa save(Mesa entity);

    List<Mesa> findAll();

    Mesa findById(long id);

    void delete(long id);

    Mesa update(long id, Mesa entity);
}