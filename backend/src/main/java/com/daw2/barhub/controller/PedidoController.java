package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.PedidoDto;
import com.daw2.barhub.model.entity.Pedido;
import com.daw2.barhub.service.PedidoService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/pedidos")
public class PedidoController {

    private final PedidoService pedidoService;

    public PedidoController(PedidoService pedidoService) {
        this.pedidoService = pedidoService;
    }

    @GetMapping({"", "/"})
    public ResponseEntity<List<PedidoDto>> index() {
        return ResponseEntity.ok(PedidoDto.from(pedidoService.findAll()));
    }

    @GetMapping("/pendientes-efectivo")
    public ResponseEntity<List<PedidoDto>> getPendientesEfectivo() {
        List<Pedido> pedidos = pedidoService.findPedidosPendientesEfectivo();
        return ResponseEntity.ok(PedidoDto.from(pedidos));
    }

    @GetMapping("/mis-pedidos")
    public ResponseEntity<?> misPedidos(Authentication authentication) {
        try {
            String username = authentication.getName();
            List<Pedido> pedidos = pedidoService.findByUsername(username);
            return ResponseEntity.ok(PedidoDto.from(pedidos));
        } catch (Exception e) {
            log.error("Error al obtener los pedidos del usuario", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("No se pudieron cargar tus pedidos."));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody PedidoDto pedidoDto, Authentication authentication) {
        try {
            String username = (authentication != null && authentication.isAuthenticated() && !authentication.getName().equals("anonymousUser"))
                    ? authentication.getName()
                    : null;

            // --- VALIDACIONES DE TIPO DE PEDIDO Y REQUERIMIENTOS ---
            if (pedidoDto.getTipoPedido() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ErrorDto.from("Es obligatorio especificar el tipo de pedido (MESA, DOMICILIO o RECOGER)."));
            }

            String tipoPedidoStr = pedidoDto.getTipoPedido().toString().toUpperCase();

            // 1. Si es pedido en MESA (Local), obligatoriamente debe incluir idMesa
            if ("MESA".equals(tipoPedidoStr) || "LOCAL".equals(tipoPedidoStr)) {
                if (pedidoDto.getIdMesa() == null) {
                    log.warn("Peticion invalida: Para pedidos en local/mesa es obligatorio seleccionar una mesa.");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(ErrorDto.from("Para pedidos en local es obligatorio seleccionar una mesa."));
                }
            }
            // 2. Si es a DOMICILIO, validar direccion de envio
            else if ("DOMICILIO".equals(tipoPedidoStr)) {
                if (pedidoDto.getDireccionEnvio() == null || pedidoDto.getDireccionEnvio().trim().isEmpty()) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(ErrorDto.from("Para pedidos a domicilio la direccion de envio es obligatoria."));
                }
            }
            // 3. Si es RECOGER, no requiere mesa ni direccion de envio

            Pedido pedidoCreado = pedidoService.crearPedidoSeguro(pedidoDto, username);
            return ResponseEntity.status(HttpStatus.CREATED).body(PedidoDto.from(pedidoCreado));

        } catch (IllegalArgumentException e) {
            // Mensajes escritos a proposito en el servicio para el cliente
            log.warn("Peticion invalida al crear pedido: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorDto.from(e.getMessage()));
        } catch (Exception e) {
            log.error("Error al procesar el pedido", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Error interno al procesar el pedido."));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            Pedido pedido = pedidoService.findById(id);
            if (pedido == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Pedido no encontrado."));
            }
            return ResponseEntity.ok(PedidoDto.from(pedido));
        } catch (Exception e) {
            log.error("Error al buscar el pedido id: {}", id, e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ErrorDto.from("No se pudo obtener el pedido."));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody PedidoDto pedidoDto) {
        try {
            Pedido pedidoActualizado = pedidoService.updateFromDto(id, pedidoDto);
            if (pedidoActualizado != null) {
                return ResponseEntity.ok(PedidoDto.from(pedidoActualizado));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Pedido no encontrado."));
            }
        } catch (Exception e) {
            log.error("Error al actualizar el pedido id: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("No se pudo actualizar el pedido."));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            pedidoService.delete(id);
            return ResponseEntity.ok().body("El pedido con ID " + id + " ha sido eliminado con exito.");
        } catch (Exception e) {
            log.error("Error al eliminar pedido ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorDto.from("No se pudo eliminar el pedido."));
        }
    }
}