package com.daw2.barhub.service;

import com.daw2.barhub.model.entity.Producto;

import java.util.List;

public interface ProductoService {
    Producto save(Producto entity);

    List<Producto> findAll();

    Producto findById(long id);

    void delete(long id);

    Producto update(long id, Producto entity);
}