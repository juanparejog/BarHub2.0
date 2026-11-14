package com.daw2.barhub.controller;

import com.daw2.barhub.model.dto.ErrorDto;
import com.daw2.barhub.model.dto.ProductoDto;
import com.daw2.barhub.model.entity.Producto;
import com.daw2.barhub.service.impl.ProductoServiceImpl;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/productos")
public class ProductoController {

    private static final Set<String> EXTENSIONES_PERMITIDAS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Pattern NOMBRE_IMAGEN_VALIDO =
            Pattern.compile("^[a-z0-9][a-z0-9._-]{0,100}\\.(jpg|jpeg|png|webp)$", Pattern.CASE_INSENSITIVE);

    @Autowired
    private ProductoServiceImpl productoService;

    @Value("${app.upload.productos:../frontend/src/assets/images/productos/}")
    private String uploadDir;

    @GetMapping("/")
    public List<ProductoDto> index() {
        return ProductoDto.from(productoService.findAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public ResponseEntity<?> create(
            @RequestPart("producto") @Valid ProductoDto productoDto,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        Path subido = null;
        try {
            subido = aplicarImagen(productoDto, file);

            Producto producto = productoDto.to();
            productoService.save(producto);
            return ResponseEntity.status(HttpStatus.OK).body(ProductoDto.from(producto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        } catch (Exception e) {
            log.error("Error al crear producto: ", e);
            borrarFichero(subido);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorDto.from("Producto no guardado"));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> show(@PathVariable Long id) {
        Producto producto = null;
        try {
            producto = productoService.findById(id);
        } catch (Exception e) {
            log.warn("Producto {} no encontrado", id);
        }
        if (producto == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorDto.from("Producto no encontrado"));
        }
        return ResponseEntity.ok(producto);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping(value = "/{id}", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestPart("producto") @Valid ProductoDto productoDto,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        Path subido = null;
        try {
            Producto anterior = productoService.findById(id);
            String imagenAnterior = anterior != null ? anterior.getImagen() : null;

            subido = aplicarImagen(productoDto, file);
            if (subido == null && (productoDto.getImagen() == null || productoDto.getImagen().isBlank())) {
                productoDto.setImagen(imagenAnterior); // sin imagen nueva se conserva la actual
            }

            Producto producto = productoDto.to();
            producto.setId(id);
            Producto actualizado = productoService.update(id, producto);

            // La imagen anterior ya no se usa: se borra para no dejar ficheros huerfanos
            if (imagenAnterior != null && !imagenAnterior.equals(actualizado.getImagen())) {
                borrarImagen(imagenAnterior);
            }
            return ResponseEntity.status(HttpStatus.OK).body(ProductoDto.from(actualizado));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ErrorDto.from(e.getMessage()));
        } catch (Exception e) {
            log.error("Error al actualizar producto: ", e);
            borrarFichero(subido);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ErrorDto.from("Producto no encontrado"));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        try {
            Producto producto = productoService.findById(id);
            if (producto != null) {
                borrarImagen(producto.getImagen());
            }
        } catch (Exception e) {
            log.error("No se pudo eliminar la imagen del producto con ID {}", id, e);
        }

        productoService.delete(id);

        return ResponseEntity.noContent().build();
    }

    // ---------- imagenes ----------

    private Path carpeta() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    /**
     * Guarda la imagen subida (devolviendo su ruta) o, si no hay fichero, valida el nombre
     * de imagen que llega en el JSON (devolviendo null).
     */
    private Path aplicarImagen(ProductoDto dto, MultipartFile file) throws IOException {
        if (file != null && !file.isEmpty()) {
            String nombre = guardarImagenEnDisco(file, dto.getNombre());
            dto.setImagen(nombre);
            return carpeta().resolve(nombre);
        }
        if (dto.getImagen() != null && !dto.getImagen().isBlank()
                && !NOMBRE_IMAGEN_VALIDO.matcher(dto.getImagen()).matches()) {
            throw new IllegalArgumentException("Nombre de imagen no valido");
        }
        return null;
    }

    private String guardarImagenEnDisco(MultipartFile file, String nombreProducto) throws IOException {
        String original = file.getOriginalFilename();
        String extension = (original != null && original.contains("."))
                ? original.substring(original.lastIndexOf('.') + 1).toLowerCase()
                : "";
        String tipo = file.getContentType();
        if (!EXTENSIONES_PERMITIDAS.contains(extension) || tipo == null || !tipo.startsWith("image/")) {
            throw new IllegalArgumentException("Formato de imagen no permitido (jpg, png o webp)");
        }

        byte[] cabecera;
        try (InputStream in = file.getInputStream()) {
            cabecera = in.readNBytes(12);
        }
        if (!cabeceraCoincide(cabecera, extension)) {
            throw new IllegalArgumentException("El archivo no es una imagen valida");
        }

        if (nombreProducto == null || nombreProducto.isBlank()) {
            nombreProducto = "producto";
        }
        String nombreLimpio = Normalizer.normalize(nombreProducto.toLowerCase().trim(), Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .replaceAll("[^a-z0-9]", "-")
                .replaceAll("-+", "-");
        if (nombreLimpio.length() > 60) {
            nombreLimpio = nombreLimpio.substring(0, 60);
        }

        // Sufijo aleatorio: nunca se pisa el fichero de otro producto
        String nombreFinal = nombreLimpio + "-" + UUID.randomUUID().toString().substring(0, 8) + "." + extension;

        Path carpeta = carpeta();
        Files.createDirectories(carpeta);

        Path destino = carpeta.resolve(nombreFinal).normalize();
        if (!destino.startsWith(carpeta)) {
            throw new IllegalArgumentException("Nombre de archivo no valido");
        }
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, destino, StandardCopyOption.REPLACE_EXISTING);
        }
        return nombreFinal;
    }

    /** Borra una imagen por nombre, solo si es un nombre valido y queda dentro de la carpeta de subidas. */
    private void borrarImagen(String nombre) {
        if (nombre == null || nombre.isBlank() || !NOMBRE_IMAGEN_VALIDO.matcher(nombre).matches()) {
            return;
        }
        Path carpeta = carpeta();
        Path ruta = carpeta.resolve(nombre).normalize();
        if (ruta.startsWith(carpeta)) {
            borrarFichero(ruta);
        }
    }

    private void borrarFichero(Path ruta) {
        if (ruta == null) {
            return;
        }
        try {
            if (Files.deleteIfExists(ruta)) {
                log.info("Imagen {} eliminada del disco.", ruta.getFileName());
            }
        } catch (IOException e) {
            log.warn("No se pudo borrar {}", ruta.getFileName(), e);
        }
    }

    /** Comprueba los primeros bytes (firma) del fichero segun la extension declarada. */
    private boolean cabeceraCoincide(byte[] h, String extension) {
        if (h.length < 12) {
            return false;
        }
        switch (extension) {
            case "jpg":
            case "jpeg":
                return (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "png":
                return (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G';
            case "webp":
                return h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                        && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
            default:
                return false;
        }
    }
}