import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Mesa } from '../interface/mesa';
import { MesaService } from '../services/mesa';

@Component({
    selector: 'app-ver-mesa',
    templateUrl: './ver-mesa.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class VerMesaComponent implements OnInit {

  mesa!: Mesa;

  constructor(
    private readonly mesaService: MesaService,
    private readonly activatedRoute: ActivatedRoute,
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
      .subscribe({
        next: mesa => {
          this.mesa = { ...mesa, estado: String(mesa.estado).toLowerCase() };
          console.log('Mesa cargada:', this.mesa);
        },
        error: error => {
          console.error('Error al cargar la mesa:', error);
        }
      });
  }
    
}