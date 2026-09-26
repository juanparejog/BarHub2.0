package com.daw2.barhub.service.impl;

import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.model.repository.DetallePedidoRepository;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.model.repository.ProductoRepository;
import com.daw2.barhub.service.DetallePedidoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DetallePedidoServiceImpl implements DetallePedidoService {

    @Autowired
    private DetallePedidoRepository detallePedidoRepository;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Override
    public DetallePedido save(DetallePedido entity) {
        return detallePedidoRepository.save(entity);
    }

    @Override
    public List<DetallePedido> findAll() {
        List<DetallePedido> detallePedidos = detallePedidoRepository.findAll();

        return detallePedidos;
    }

    @Override
    public DetallePedido findById(long id) {
        return detallePedidoRepository.findDetallePedidoById(id);
    }

    @Override
    public void delete(long id) {
        DetallePedido detallePedido = detallePedidoRepository.findById(id);

        if(detallePedido != null){
            detallePedidoRepository.delete(detallePedido);
        }
    }

    @Override
    public DetallePedido update(long id, DetallePedido entity) {
        DetallePedido detallePedidoExistente = detallePedidoRepository.findById(id);

        if(detallePedidoExistente != null){
            if(entity.getPedido() != null && entity.getPedido().getId() != null ){
                Pedido pedido = pedidoRepository.findById(entity.getPedido().getId())
                        .orElseThrow(() -> new RuntimeException("Pedido no encontrado"));
                detallePedidoExistente.setPedido(pedido);
            }

            if(entity.getProducto() != null && entity.getProducto().getId() != null ){
                Producto producto = productoRepository.findById(entity.getProducto().getId())
                        .orElseThrow(() -> new RuntimeException("Producto no encontrado"));
                detallePedidoExistente.setProducto(producto);
            }

            detallePedidoExistente.setCantidad(entity.getCantidad());
            detallePedidoExistente.setPrecioUnitario(
                    entity.getPrecioUnitario() != null ? entity.getPrecioUnitario() : detallePedidoExistente.getPrecioUnitario()
            );


            return detallePedidoRepository.save(detallePedidoExistente);
        } else {
            return null;
        }
    }
}
