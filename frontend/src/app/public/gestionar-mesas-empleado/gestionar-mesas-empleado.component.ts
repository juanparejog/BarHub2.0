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
  mesaSeleccionadaQr: Mesa | null = null;

  estados = [
    { value: 'disponible', label: 'Disponible', icon: 'event_available', classBadge: 'bg-success' },
    { value: 'ocupada', label: 'Ocupada', icon: 'table_restaurant', classBadge: 'bg-danger' },
    { value: 'reservada', label: 'Reservada', icon: 'event_note', classBadge: 'bg-warning text-dark' }
  ];

  constructor(private readonly mesaService: MesaService) {}

  ngOnInit() {
    this.cargarMesas();
  }

  getCountByEstado(estadoNombre: string): number {
    if (!this.mesas) return 0;
    return this.mesas.filter(m => String(m.estado).toUpperCase() === estadoNombre.toUpperCase()).length;
  }

  cargarMesas() {
    this.mesaService.get().subscribe({
      next: (data) => (this.mesas = data),
      error: (err) => console.error('Error al cargar mesas:', err)
    });
  }

  setEstado(mesa: Mesa, estado: string) {
    if (mesa.estado === estado) return;
    const mesaActualizada = { ...mesa, estado };

    this.mesaService.put(mesaActualizada).subscribe({
      next: () => (mesa.estado = estado),
      error: () => alert('Error actualizando el estado de la mesa')
    });
  }

  getIconForEstado(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found ? found.icon : 'table_bar';
  }

  getLabelForEstado(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found ? found.label : estado;
  }

  getBadgeClass(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found ? found.classBadge : 'bg-secondary';
  }

  verQr(mesa: Mesa) {
    this.mesaSeleccionadaQr = mesa;
  }

  cerrarModalQr() {
    this.mesaSeleccionadaQr = null;
  }

  getUrlQr(codigoQr: string | undefined, id: number | undefined): string {
    const mesaId = codigoQr || id || 1;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://barhub.duckdns.org/carta?mesa=${mesaId}`;
  }
}