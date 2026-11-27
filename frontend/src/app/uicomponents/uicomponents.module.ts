import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MenuComponent } from './menu/menu.component';

import { SelectorIdiomaComponent } from '../shared/i18n/selector-idioma.component';
import { TraducirPipe } from '../shared/i18n/traducir.pipe';

@NgModule({
  declarations: [
    MenuComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    TraducirPipe,
    SelectorIdiomaComponent
  ],
  exports:[
    MenuComponent
  ]
})
export class UicomponentsModule { }
