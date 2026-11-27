import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastComponent } from './custom-toast/toast.component';
import { ModalConfirmarEliminarComponent } from './modals/modal-confirmar-eliminar/modal-confirmar-eliminar.component';

import { TraducirPipe } from './i18n/traducir.pipe';

@NgModule({
  declarations: [ToastComponent, ModalConfirmarEliminarComponent],
  imports: [CommonModule, RouterModule, TraducirPipe],
  exports: [ToastComponent, ModalConfirmarEliminarComponent]
})
export class SharedModule { }