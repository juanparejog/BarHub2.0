package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.MesaDto;
import com.daw2.barhub.model.entity.Mesa;
import com.daw2.barhub.service.impl.MesaServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "http://localhost:4200")
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("Mesa no guardada: " + e.getMessage()));
        }
    }

    @GetMapping("{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            return ResponseEntity.status(HttpStatus.OK).body(mesaService.findById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorDto.from("Mesa no encontrada: " + e.getMessage()));
        }
    }

    @PutMapping("{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Mesa mesa) {
        try {
            Mesa mesaActualizada =  mesaService.update(id, mesa);
            return ResponseEntity.status(HttpStatus.OK).body(MesaDto.from(mesaActualizada));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Mesa no encontrada: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMesa(@PathVariable Long id) {
        mesaService.delete(id);
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}