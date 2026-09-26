package com.daw2.barhub.service.impl;

import com.daw2.barhub.model.Enum.EstadoPago;
import com.daw2.barhub.model.Enum.MetodoPago;
import com.daw2.barhub.model.entity.Pago;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.repository.PagoRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.service.PagoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PagoServiceImpl implements PagoService {

    @Autowired
    private PagoRepository pagoRepository;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Override
    public Pago save(Pago entity) { return this.pagoRepository.save(entity); }

    @Override
    public List<Pago> findAll() { return pagoRepository.findAll(); }

    @Override
    public Pago findById(long id) { return pagoRepository.findPagoById(id); }

    @Override
    public void delete(long id) {
        Pago pago = pagoRepository.findPagoById(id);

        if (pago != null) {
            pagoRepository.delete(pago);
        }
    }

    @Override
    public Pago update(long id, Pago entity) {
        Pago pagoExistente = this.pagoRepository.findPagoById(id);

        if (pagoExistente != null) {
            if (entity.getPedido() != null) {
                Pedido pedido = pedidoRepository.findById(entity.getPedido().getId())
                        .orElseThrow(() -> new RuntimeException("Pedido no encontrado"));
                pagoExistente.setPedido(pedido);
            }

            pagoExistente.setEstadoPago(entity.getEstadoPago());
            pagoExistente.setMetodoPago(entity.getMetodoPago());
            pagoExistente.setTotal(entity.getTotal());
            pagoExistente.setFechaPago(entity.getFechaPago());

            return pagoRepository.save(pagoExistente);
        } else {
            return null;
        }
    }

    @Override
    public List<Pago> obtenerPagosPorMetodoYEstado(String metodo, String estado) {
        MetodoPago metodoEnum = MetodoPago.valueOf(metodo.toLowerCase());
        EstadoPago estadoEnum = EstadoPago.valueOf(estado.toLowerCase());
        return pagoRepository.findByMetodoAndEstado(metodoEnum, estadoEnum);
    }

}