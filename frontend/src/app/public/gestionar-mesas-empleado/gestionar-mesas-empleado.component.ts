import { Component, OnInit } from '@angular/core';
import { MesaService } from '../../admin/pages/mesas/services/mesa';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';

@Component({
  selector: 'app-gestionar-mesas-empleado',
  templateUrl: './gestionar-mesas-empleado.component.html',
  styleUrls: ['./gestionar-mesas-empleado.component.css']
})
export class GestionarMesasEmpleadoComponent implements OnInit {
  mesas: Mesa[] = [];
  estados = [
    { value: 'disponible', label: 'Disponible', icon: 'event_available' },
    { value: 'reservada', label: 'Reservada', icon: 'event_note' },
  ];

  constructor(private mesaService: MesaService) {}

  ngOnInit() {
    this.cargarMesas();
  }

  cargarMesas() {
    this.mesaService.get().subscribe(data => this.mesas = data);
  }

  setEstado(mesa: Mesa, estado: string) {
    if (mesa.estado === estado) return;
    const mesaActualizada = { ...mesa, estado };
    this.mesaService.put(mesaActualizada).subscribe({
      next: () => mesa.estado = estado,
      error: () => alert('Error actualizando el estado de la mesa')
    });
  }

  getIconForEstado(estado: string): string {
    const found = this.estados.find(e => e.value === estado);
    return found ? found.icon : '';
  }
  
  getLabelForEstado(estado: string): string {
    const found = this.estados.find(e => e.value === estado);
    return found ? found.label : estado;
  }
  
}