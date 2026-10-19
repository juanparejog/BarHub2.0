package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.ProductoDto;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.service.impl.ProductoServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.List;

@CrossOrigin("*")
@Slf4j
@RestController
@RequestMapping("/productos")
public class ProductoController {

    @Autowired
    private ProductoServiceImpl productoService;

    private static final String UPLOADDIR = "../frontend/src/assets/images/productos/";

    @GetMapping("/")
    public List<ProductoDto> index() {
        return ProductoDto.from(productoService.findAll());
    }

    @PostMapping(value = "/", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public ResponseEntity<?> create(
            @RequestPart("producto") ProductoDto productoDto,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        try {
            if (file != null && !file.isEmpty()) {
                String nombreImagen = guardarImagenEnDisco(file, productoDto.getNombre());
                productoDto.setImagen(nombreImagen);
            }

            Producto producto = productoDto.to();
            productoService.save(producto);
            return ResponseEntity.status(HttpStatus.OK).body(ProductoDto.from(producto));
        } catch (Exception e) {
            log.error("Error al crear producto: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Producto no guardado: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        try {
            return ResponseEntity.status(HttpStatus.OK).body(productoService.findById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ErrorDto.from("Producto no encontrado: " + e.getMessage()));
        }
    }

    @PutMapping(value = "/{id}", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestPart("producto") ProductoDto productoDto,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        try {
            if (file != null && !file.isEmpty()) {
                String nombreImagen = guardarImagenEnDisco(file, productoDto.getNombre());
                productoDto.setImagen(nombreImagen);
            }

            Producto producto = productoDto.to();
            producto.setId(id);
            Producto productoActualizado = productoService.update(id, producto);
            return ResponseEntity.status(HttpStatus.OK).body(ProductoDto.from(productoActualizado));
        } catch (Exception e) {
            log.error("Error al actualizar producto: ", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorDto.from("Producto no encontrado: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        try {
            Producto producto = productoService.findById(id);

            if (producto != null && producto.getImagen() != null && !producto.getImagen().isBlank()) {
                Path rutaImagen = Paths.get(UPLOADDIR).resolve(producto.getImagen()).toAbsolutePath().normalize();

                boolean borrado = Files.deleteIfExists(rutaImagen);
                if (borrado) {
                    log.info("Imagen {} eliminada correctamente del disco.", producto.getImagen());
                }
            }
        } catch (Exception e) {
            log.error("No se pudo eliminar la imagen del producto con ID {}: {}", id, e.getMessage());
        }

        productoService.delete(id);

        return ResponseEntity.noContent().build();
    }

    private String guardarImagenEnDisco(MultipartFile file, String nombreProducto) throws IOException {
        if (nombreProducto == null || nombreProducto.isBlank()) {
            nombreProducto = "producto";
        }

        String nombreLimpio = Normalizer.normalize(nombreProducto.toLowerCase().trim(), Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .replaceAll("[^a-z0-9]", "-")
                .replaceAll("-+", "-");

        String originalFilename = file.getOriginalFilename();
        String extension = "jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".") + 1);
        }

        String nombreFinal = nombreLimpio + "." + extension;

        Path uploadPath = Paths.get(UPLOADDIR).toAbsolutePath().normalize();
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        Path filePath = uploadPath.resolve(nombreFinal);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        return nombreFinal;
    }
}