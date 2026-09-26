import { Component } from '@angular/core';
import { OnInit } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap } from "rxjs";
import { ProductoService } from "../services/producto";
import { Producto } from "../interface/producto";

@Component({
  selector: 'app-editar-producto',
  templateUrl: './editar-producto.component.html',
})
export class EditarProductoComponent implements OnInit {

  formulario: FormGroup = this.fb.group({
    id: [-1],
    nombre: [],
    descripcion: [],
    precio: [],
    tipoProducto: [],
    imagen: []
  });
  editar: boolean = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private productoService: ProductoService,
  ) { }

  ngOnInit(): void {
    if (this.router.url.includes('editar')) {
      this.cargarProducto();
      this.editar = true;
    }
  }

  guardar() {
    if (this.formulario.get('id')?.value > 0) {
      this.editarProducto();
    } else {
      this.crearProducto();
    }
  }

  cargarProducto() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => this.productoService.getId(id)),
      )
      .subscribe({
        next: (producto: Producto) => {
          this.formulario.reset(producto);
        },
        error: () => {
          this.router.navigate(['/admin/gestionar-producto']);
        }
      });
  }

  crearProducto() {
    console.log("Datos enviados:", this.formulario.getRawValue());
    console.log("Datos enviados:", this.formulario.value);
  
    const nuevoProducto: Producto = {
      nombre: this.formulario.value.nombre,
      descripcion: this.formulario.value.descripcion,
      precio: this.formulario.value.precio,
      tipoProducto: this.formulario.value.tipoProducto,
      imagen: this.formulario.value.imagen
    };

    this.productoService.post(nuevoProducto).subscribe(
      response => {
        console.log('Producto creado:', response);
        this.router.navigate(['/admin/gestionar-productos']);
      },
      error => {
        console.error('Error al crear el producto:', error);
      });
  }

  editarProducto() {
    const datosProducto = this.formulario.getRawValue();
    console.log('Datos enviados al servicio:', datosProducto);
  
    this.productoService.put(datosProducto).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        this.router.navigate(['/admin/gestionar-productos']);
      },
      error: (err) => {
        console.error('Error en la petición PUT:', err);
      }
    });
  }  
}