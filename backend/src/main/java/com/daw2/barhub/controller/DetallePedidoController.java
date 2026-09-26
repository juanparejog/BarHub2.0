package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.DetallePedidoDto;
import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.entity.DetallePedido;
import com.daw2.barhub.model.repository.DetallePedidoRepository;
import com.daw2.barhub.service.DetallePedidoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin("*")
@Slf4j
@RestController
@RequestMapping("/detalles_pedidos")
public class DetallePedidoController {
    @Autowired
    private DetallePedidoRepository detallePedidoRepository;

    @Autowired
    private DetallePedidoService detallePedidoService;

    @GetMapping("/")
    public List<DetallePedidoDto> index() {
        return DetallePedidoDto.from(detallePedidoService.findAll());
    }

    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody DetallePedidoDto detallePedidoDto) {
        try {
            DetallePedido detallePedido = detallePedidoDto.to();
            detallePedidoService.save(detallePedido);
            return ResponseEntity.ok(DetallePedidoDto.from(detallePedido));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("El detalle del pedido no ha sido guardado " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(DetallePedidoDto.from(detallePedidoService.findById(id)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorDto.from("El detalle del pedido no ha sido encontrado " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody DetallePedido detallePedido) {
        try {
            DetallePedido detallePedidoActualizado = detallePedidoService.update(id, detallePedido);
            if (detallePedidoActualizado != null) {
                return ResponseEntity.status(HttpStatus.OK).body(detallePedidoActualizado);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("El detalle del pedido no ha sido encontrado."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            detallePedidoService.delete(id);
            return ResponseEntity.status(HttpStatus.OK).body("El detalle del pedido con id " + id + " ha sido eliminado");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("El detalle del pedido no ha sido encontrado " + e.getMessage()));
        }
    }

    @GetMapping("/pedido/{pedidoId}")
    public ResponseEntity<List<DetallePedido>> getDetallesByPedidoId(@PathVariable Long pedidoId) {
        List<DetallePedido> detalles = detallePedidoRepository.findByPedidoId(pedidoId);
        return ResponseEntity.ok(detalles);
    }
}