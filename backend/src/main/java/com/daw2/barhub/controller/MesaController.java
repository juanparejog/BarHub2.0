package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.MesaDto;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.model.enums.EstadoMesa;
import com.daw2.barhub.service.impl.MesaServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/mesas")
public class MesaController {
    @Autowired
    private MesaServiceImpl mesaService;

    @GetMapping("/")
    public List<MesaDto> index() {
        return MesaDto.from(mesaService.findAll());
    }

    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody MesaDto mesaDto) {
        try {
            Mesa mesa = mesaDto.to();
            mesaService.save(mesa);
            return ResponseEntity.status(HttpStatus.OK).body(MesaDto.from(mesa));
        } catch (Exception e) {
            log.error("Error al procesar la peticion", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("Mesa no guardada."));
        }
    }

    @GetMapping("{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        Mesa mesa = null;
        try {
            mesa = mesaService.findById(id);
        } catch (Exception e) {
            log.warn("Mesa {} no encontrada", id);
        }
        if (mesa == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Mesa no encontrada."));
        }
        return ResponseEntity.ok(mesa);
    }

    @PutMapping("{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Mesa mesa) {
        try {
            Mesa mesaActualizada =  mesaService.update(id, mesa);
            return ResponseEntity.status(HttpStatus.OK).body(MesaDto.from(mesaActualizada));
        } catch (Exception e) {
            log.error("Error al procesar la peticion", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Mesa no encontrada."));
        }
    }

    /** Lo que se puede cambiar desde la sala: solo el estado. Empleados y administradores (ver SecurityConfig). */
    public record CambioEstado(EstadoMesa estado) {
    }

    @PatchMapping("{id}/estado")
    public ResponseEntity<?> cambiarEstado(@PathVariable Long id, @RequestBody CambioEstado cambio) {
        if (cambio == null || cambio.estado() == null) {
            return ResponseEntity.badRequest().body(ErrorDto.from("Indica el estado: DISPONIBLE, OCUPADA o RESERVADA."));
        }
        Mesa mesa = mesaService.findById(id);
        if (mesa == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Mesa no encontrada."));
        }
        mesa.setEstado(cambio.estado());
        return ResponseEntity.ok(MesaDto.from(mesaService.save(mesa)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMesa(@PathVariable Long id) {
        mesaService.delete(id);
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}