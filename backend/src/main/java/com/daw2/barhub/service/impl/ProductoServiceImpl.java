package com.daw2.barhub.service.impl;

import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.repository.ProductoRepository;
import com.daw2.barhub.service.ProductoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProductoServiceImpl implements ProductoService {

    @Autowired
    private ProductoRepository productoRepository;


    @Override
    public Producto save(Producto entity) {
        return productoRepository.save(entity);
    }

    @Override
    public List<Producto> findAll() {
        List<Producto> productos = productoRepository.findAll();

        return productos;
    }

    @Override
    public Producto findById(long id) {
        Producto producto = productoRepository.findById(id);

        return producto;
    }

    @Override
    public void delete(long id) {
        Producto producto = productoRepository.findById(id);
        if (producto != null) {
            productoRepository.delete(producto);
        }
    }

    @Override
    public Producto update(long id, Producto entity) {
        Producto productoExistente = productoRepository.findById(id);

        if (productoExistente != null) {
            productoExistente.setNombre(entity.getNombre());
            productoExistente.setDescripcion(entity.getDescripcion());
            productoExistente.setPrecio(entity.getPrecio());
            productoExistente.setImagen(entity.getImagen());
            return productoRepository.save(productoExistente);
        } else {
            return null;
        }
    }
}