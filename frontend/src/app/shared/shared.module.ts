import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastComponent } from './custom-toast/toast.component';

@NgModule({
  declarations: [ToastComponent],
  imports: [CommonModule, RouterModule],
  exports: [ToastComponent]
})
export class SharedModule { }