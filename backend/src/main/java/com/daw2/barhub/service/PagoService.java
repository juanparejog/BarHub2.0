package com.daw2.barhub.service;

import com.daw2.barhub.model.entity.Pago;

import java.util.List;

public interface PagoService {
    Pago save(Pago entity);

    List<Pago> findAll();

    Pago findById(long id);

    void delete(long id);

    Pago update(long id, Pago entity);

    List<Pago> obtenerPagosPorMetodoYEstado(String metodo, String estado);
}
