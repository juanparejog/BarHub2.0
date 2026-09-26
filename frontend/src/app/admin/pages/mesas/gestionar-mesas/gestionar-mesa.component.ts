import { Component, OnInit } from '@angular/core';
import { MesaService } from '../services/mesa';
import { Mesa } from '../interface/mesa';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';
import { tap } from 'rxjs';

@Component({
  selector: 'app-gestionar-mesa',
  templateUrl: './gestionar-mesa.component.html'
})
export class GestionarMesaComponent implements OnInit {

  mesas: Mesa[] = [];

  constructor(
    private mesaService: MesaService,
    private dialogService: DialogService,
  ) { }

  ngOnInit(): void {
    this.cargarMesas();
  }

  cargarMesas() {
    this.mesaService.get().subscribe(mesas => {
      console.log('Mesas cargadas:', mesas);
      this.mesas = mesas;
    });
  }

  borrarMesa(mesa: Mesa) {
    this.dialogService.solicitarConfirmacion('¿Está seguro de que desea eliminar la mesa?',
       'Eliminar mesa', 
      () => {
      this.mesaService.del(mesa)
        .subscribe(() => {
          this.dialogService.mostrarToast('Mesa eliminada correctamente');
          this.cargarMesas();
        });
    });
  }
}