import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-confirmar-eliminar',
  templateUrl: './modal-confirmar-eliminar.component.html',
  styleUrls: ['./modal-confirmar-eliminar.component.css']
})
export class ModalConfirmarEliminarComponent {

  @Input() mostrar: boolean = false;
  @Input() titulo: string = 'Confirmar eliminación';
  @Input() mensaje: string = '¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.';
  @Input() nombreElemento: string = '';

  @Output() alConfirmar = new EventEmitter<void>();
  @Output() alCancelar = new EventEmitter<void>();

  confirmar(): void {
    this.alConfirmar.emit();
  }

  cancelar(): void {
    this.alCancelar.emit();
  }
}