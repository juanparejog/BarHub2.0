import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { UicomponentsModule } from './uicomponents/uicomponents.module';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './auth/auth.interceptor';
import { ReactiveFormsModule } from '@angular/forms';
import { CartaComponent } from './public/carta/carta.component';
import { ContactoComponent } from './public/contacto/contacto.component';
import { ConfirmarPedidoComponent } from './public/confirmar-pedido/confirmar-pedido.component';
import { GestionarComandasComponent } from './public/gestionar-comandas/gestionar-comandas.component';
import { GestionarMesasEmpleadoComponent } from './public/gestionar-mesas-empleado/gestionar-mesas-empleado.component';
import { GestionarPagosEfectivoComponent } from './public/gestionar-pagos-efectivo/gestionar-pagos-efectivo.component';
import { SeguimientoPedidosComponent } from './public/seguimiento-pedidos/seguimiento-pedidos.component';
import { PoliticaPrivacidadComponent } from './public/politica-privacidad/politica-privacidad.component';
import { TerminosCondicionesComponent } from './public/terminos-condiciones/terminos-condiciones.component';

import { FormsModule } from '@angular/forms';
import { SharedModule } from './shared/shared.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HomeComponent } from './public/home/home.component';
import { FooterComponent } from './shared/footer/footer.component';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { environment } from "src/environments/environment";
import { PerfilComponent } from './public/perfil/perfil.component';

const config: SocketIoConfig = { 
  url: 'http://localhost:8080', 
  options: {
    transports: ['websocket']
  } 
};
@NgModule({
  declarations: [
    AppComponent,
    CartaComponent,
    ContactoComponent,
    ConfirmarPedidoComponent,
    GestionarComandasComponent,
    GestionarMesasEmpleadoComponent,
    GestionarPagosEfectivoComponent,
    SeguimientoPedidosComponent,
    HomeComponent,
    FooterComponent,
    PoliticaPrivacidadComponent,
    TerminosCondicionesComponent,
    PerfilComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    UicomponentsModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    SharedModule,
    SocketIoModule.forRoot(config)
  ],  
  exports: [
    CartaComponent
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }