import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap } from "rxjs";
import { ProductoService } from "../services/producto";
import { Producto } from "../interface/producto";

@Component({
  selector: 'app-editar-productos',
  templateUrl: './editar-producto.component.html',
})
export class EditarProductoComponent implements OnInit {

  formulario: FormGroup = this.fb.group({
    id: [-1],
    nombre: [''],
    descripcion: [''],
    precio: [''],
    tipoProducto: [''],
    imagen: ['']
  });

  editar: boolean = false;
  isDragging: boolean = false;
  archivoSeleccionado: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  nombreArchivoRenombrado: string = '';

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly productoService: ProductoService,
  ) { }

  ngOnInit(): void {
    if (this.router.url.includes('editar')) {
      this.cargarProducto();
      this.editar = true;
    }
  }

  // --- Eventos Drag & Drop ---
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivo(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  private procesarArchivo(file: File): void {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    this.archivoSeleccionado = file;
    this.actualizarNombreArchivo();

    // Generar vista previa local
    const reader = new FileReader();
    reader.onload = () => this.previewUrl = reader.result;
    reader.readAsDataURL(file);
  }

  // Genera un archivo con el nombre del producto (ej: "gambas.jpg")
  private obtenerArchivoRenombrado(): File | null {
    if (!this.archivoSeleccionado) return null;

    const nombreForm = this.formulario.get('nombre')?.value || 'producto';
    
    // Normaliza el texto: minúsculas, elimina tildes y espacios
    const nombreLimpio = nombreForm
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const extension = this.archivoSeleccionado.name.split('.').pop() || 'jpg';
    this.nombreArchivoRenombrado = `${nombreLimpio}.${extension}`;

    return new File([this.archivoSeleccionado], this.nombreArchivoRenombrado, {
      type: this.archivoSeleccionado.type
    });
  }

  private actualizarNombreArchivo(): void {
    if (this.archivoSeleccionado) {
      this.obtenerArchivoRenombrado();
    }
  }

  guardar(): void {
    if (this.formulario.get('id')?.value > 0) {
      this.editarProducto();
    } else {
      this.crearProducto();
    }
  }

  cargarProducto(): void {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => this.productoService.getId(id)),
      )
      .subscribe({
        next: (producto: Producto) => {
          this.formulario.reset(producto);
          if (producto.imagen) {
            this.previewUrl = `assets/images/productos/${producto.imagen}`;
            this.nombreArchivoRenombrado = producto.imagen;
          }
        },
        error: () => {
          void this.router.navigate(['/admin/gestionar-producto']);
        }
      });
  }

  crearProducto(): void {
    const archivoFinal = this.obtenerArchivoRenombrado();
    const nombreImagenFinal = archivoFinal ? archivoFinal.name : this.formulario.value.imagen;

    const nuevoProducto: Producto = {
      ...this.formulario.value,
      id: null,
      imagen: nombreImagenFinal
    };

    this.productoService.post(nuevoProducto, archivoFinal).subscribe({
      next: (response) => {
        console.log('Producto creado con éxito:', response);
        void this.router.navigate(['/admin/gestionar-productos']);
      },
      error: (error) => console.error('Error al crear el producto:', error)
    });
  }

  editarProducto(): void {
    const archivoFinal = this.obtenerArchivoRenombrado();
    if (archivoFinal) {
      this.formulario.patchValue({ imagen: archivoFinal.name });
    }

    const datosProducto: Producto = this.formulario.getRawValue();

    this.productoService.put(datosProducto, archivoFinal).subscribe({
      next: (response) => {
        console.log('Producto editado con éxito:', response);
        void this.router.navigate(['/admin/gestionar-productos']);
      },
      error: (err) => console.error('Error en la petición PUT:', err)
    });
  }
}