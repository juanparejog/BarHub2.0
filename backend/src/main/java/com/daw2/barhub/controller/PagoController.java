package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.PagoDto;
import com.daw2.barhub.model.entity.Pago;
import com.daw2.barhub.service.PagoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin("*")
@Slf4j
@RestController
@RequestMapping("/pagos")
public class PagoController {
    @Autowired
    private PagoService pagoService;

    @GetMapping("/")
    public List<Pago> index() {
        return pagoService.findAll();
    }

    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody PagoDto pagoDto) {
        try {
            Pago pago = pagoDto.to();
            pagoService.save(pago);
            return ResponseEntity.ok(PagoDto.from(pago));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("El pago no ha sido guardado " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(PagoDto.from(pagoService.findById(id)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("Error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Pago pago) {
        try {
            Pago pagoActualizado = pagoService.update(id, pago);
            if (pagoActualizado != null) {
                return ResponseEntity.status(HttpStatus.OK).body(pagoActualizado);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("El pago no ha sido encontrado."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            pagoService.delete(id);
            return ResponseEntity.status(HttpStatus.OK).body("El pago con id " + id + " ha sido eliminado");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("El pago no ha sido encontrado " + e.getMessage()));
        }
    }

    @GetMapping("/pendientes/efectivo")
    public ResponseEntity<List<Pago>> getPagosPendientesEfectivo() {
        List<Pago> pagos = pagoService.obtenerPagosPorMetodoYEstado("efectivo", "pendiente");
        return ResponseEntity.ok(pagos);
    }

}