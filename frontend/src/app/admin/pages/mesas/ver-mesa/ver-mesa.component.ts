import { Component, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Mesa } from '../interface/mesa';
import { MesaService } from '../services/mesa';

@Component({
  selector: 'app-ver-mesa',
  templateUrl: './ver-mesa.component.html'
})
export class VerMesaComponent implements OnInit {

  mesa!: Mesa;

  constructor(
    private mesaService: MesaService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarMesa();
  }
  
  cargarMesa() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => {
          return this.mesaService.getId(id);
        }),
      )
      .subscribe(
        mesa => {
          this.mesa = mesa;
          console.log('Mesa cargada:', this.mesa);
        },
        error => {
          console.error('Error al cargar la mesa:', error);
        }
      );
  }
    
}