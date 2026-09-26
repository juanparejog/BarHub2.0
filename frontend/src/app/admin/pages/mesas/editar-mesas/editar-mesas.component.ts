import { Component } from '@angular/core';
import { OnInit } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap } from "rxjs";
import { MesaService } from "../services/mesa";
import { Mesa } from "../interface/mesa";

@Component({
  selector: 'app-editar-mesa',
  templateUrl: './editar-mesa.component.html',
})
export class EditarMesaComponent implements OnInit {

  formulario: FormGroup = this.fb.group({
    id: [-1],
    codigoqr: [],
    estado: []
  });
  editar: boolean = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private mesaService: MesaService,
  ) { }

  ngOnInit(): void {
    if (this.router.url.includes('editar')) {
      this.cargarMesa();
      this.editar = true;
    }
  }

  guardar() {
    if (this.formulario.get('id')?.value > 0) {
      this.editarMesa();
    } else {
      this.crearMesa();
    }
  }

  cargarMesa() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => this.mesaService.getId(id)),
      )
      .subscribe({
        next: (mesa: Mesa) => {
          this.formulario.reset(mesa);
        },
        error: () => {
          this.router.navigate(['/admin/gestionar-mesa']);
        }
      });
  }

  crearMesa() {
    console.log("Datos enviados:", this.formulario.getRawValue());
    console.log("Datos enviados:", this.formulario.value);
  
    const nuevaMesa: Mesa = {
      codigoqr: this.formulario.value.codigoqr,
      estado: this.formulario.value.estado
    };

    this.mesaService.post(nuevaMesa).subscribe(
      response => {
        console.log('Mesa creada:', response);
        this.router.navigate(['/admin/gestionar-mesas']);
      },
      error => {
        console.error('Error al crear la mesa:', error);
      });
  }

  editarMesa() {
    const datosMesa = this.formulario.getRawValue();
    console.log('Datos enviados al servicio:', datosMesa);
  
    this.mesaService.put(datosMesa).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        this.router.navigate(['/admin/gestionar-mesas']);
      },
      error: (err) => {
        console.error('Error en la petición PUT:', err);
      }
    });
  }  
}