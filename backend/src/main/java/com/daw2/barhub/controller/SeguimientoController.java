package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.dto.seguimiento.DetallePedidoDto;
import com.daw2.barhub.model.dto.seguimiento.PedidoDTO;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.model.repository.PedidoRepository;
import com.daw2.barhub.service.PedidoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@CrossOrigin("*")
@Slf4j
@RestController
@RequestMapping("/seguimientos")
public class SeguimientoController {
    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private PedidoService pedidoService;

    @GetMapping("/")
    public List<PedidoDto> index() {
        return PedidoDto.from(pedidoService.findAll());
    }

    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody PedidoDto pedidoDto) {
        try {
            Pedido pedido = pedidoDto.to();
            pedidoService.save(pedido);
            return ResponseEntity.ok(PedidoDto.from(pedido));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("Pedido no guardado " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(PedidoDto.from(pedidoService.findById(id)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorDto.from("Pedido no encontrado " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Pedido pedido) {
        try {
            Pedido pedidoActualizado = pedidoService.update(id, pedido);
            if (pedidoActualizado != null) {
                return ResponseEntity.status(HttpStatus.OK).body(pedidoActualizado);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Pedido no encontrado."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            pedidoService.delete(id);
            return ResponseEntity.status(HttpStatus.OK).body("El pedido con id " + id + " ha sido eliminado");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Pedido no encontrado " + e.getMessage()));
        }
    }

    @GetMapping("/usuario/{usuarioId}")
    public ResponseEntity<?> getPedidosByUsuario(
            @PathVariable Long usuarioId
    ) {
        try {
            List<Pedido> pedidos = pedidoService.findByUsuarioIdWithDetalles(usuarioId);

            // Convertir a DTO para evitar recursividad en JSON
            List<PedidoDTO> response = pedidos.stream()
                    .map(this::convertirADto)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Error: " + e.getMessage());
        }
    }

    private PedidoDTO convertirADto(Pedido pedido) {
        PedidoDTO dto = new PedidoDTO();
        dto.setId(pedido.getId());
        dto.setFecha(pedido.getFecha());
        dto.setEstado(pedido.getEstado());
        dto.setTotal(pedido.getPrecioTotal());

        // Convertir detalles
        List<DetallePedidoDto> detallesDto = pedido.getDetalles().stream()
                .map(detalle -> {
                    DetallePedidoDto detalleDto = new DetallePedidoDto();
                    detalleDto.setProductoNombre(detalle.getProducto().getNombre());
                    detalleDto.setCantidad(detalle.getCantidad());
                    detalleDto.setPrecioUnitario(detalle.getPrecioUnitario());
                    return detalleDto;
                })
                .collect(Collectors.toList());

        dto.setDetalles(detallesDto);
        return dto;
    }
}