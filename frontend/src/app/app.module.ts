import { AlergenoIconoComponent } from './shared/alergenos/alergeno-icono.component';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { UicomponentsModule } from './uicomponents/uicomponents.module';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { AuthInterceptor } from './auth/auth.interceptor';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CartaComponent } from './public/carta/carta.component';
import { ContactoComponent } from './public/contacto/contacto.component';
import { ConfirmarPedidoComponent } from './public/confirmar-pedido/confirmar-pedido.component';
import { GestionarCajaComponent } from './public/gestionar-caja/gestionar-caja.component';
import { GestionarComandasComponent } from './public/gestionar-comandas/gestionar-comandas.component';
import { GestionarMesasEmpleadoComponent } from './public/gestionar-mesas-empleado/gestionar-mesas-empleado.component';
import { GestionarPagosEfectivoComponent } from './public/gestionar-pagos-efectivo/gestionar-pagos-efectivo.component';
import { SeguimientoPedidosComponent } from './public/seguimiento-pedidos/seguimiento-pedidos.component';
import { PoliticaPrivacidadComponent } from './public/politica-privacidad/politica-privacidad.component';
import { TerminosCondicionesComponent } from './public/terminos-condiciones/terminos-condiciones.component';
import { SharedModule } from './shared/shared.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './public/home/home.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AvisoSesionComponent } from './shared/aviso-sesion/aviso-sesion.component';
import { ReautenticacionComponent } from './shared/reautenticacion/reautenticacion.component';

import { PrecioPipe, TraducirPipe } from './shared/i18n/traducir.pipe';

@NgModule({ declarations: [
        AppComponent,
        CartaComponent,
        ContactoComponent,
        ConfirmarPedidoComponent,
        GestionarCajaComponent,
        GestionarComandasComponent,
        GestionarMesasEmpleadoComponent,
        GestionarPagosEfectivoComponent,
        SeguimientoPedidosComponent,
        HomeComponent,
        FooterComponent,
        PoliticaPrivacidadComponent,
        TerminosCondicionesComponent
    ],
    exports: [
        CartaComponent
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        UicomponentsModule,
        FormsModule,
        ReactiveFormsModule,
        SharedModule,
        AvisoSesionComponent,
        ReautenticacionComponent,
        AlergenoIconoComponent,
        TraducirPipe,
        PrecioPipe], providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        provideHttpClient(withXhr(), withInterceptorsFromDi())
    ] })
export class AppModule { }