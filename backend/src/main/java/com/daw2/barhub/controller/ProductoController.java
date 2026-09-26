package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.ProductoDto;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.service.impl.ProductoServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin("*")
@Slf4j
@RestController
@RequestMapping("/productos")
public class ProductoController {
    @Autowired
    private ProductoServiceImpl productoService;

    @GetMapping("/")
    public List<ProductoDto> index() {
        return ProductoDto.from(productoService.findAll());
    }

    @PostMapping("/")
    public ResponseEntity<?> create(@RequestBody ProductoDto productoDto) {
        try {
            Producto producto = productoDto.to();
            productoService.save(producto);
            return ResponseEntity.status(HttpStatus.OK).body(ProductoDto.from(producto));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ErrorDto.from("Producto no guardado " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            return ResponseEntity.status(HttpStatus.OK).body(productoService.findById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorDto.from("Producto no encontrado: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Producto producto) {
        try {
            Producto productoActualizado =  productoService.update(id, producto);
            return ResponseEntity.status(HttpStatus.OK).body(ProductoDto.from(productoActualizado));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorDto.from("Producto no encontrado: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMesa(@PathVariable Long id) {
        productoService.delete(id);
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}