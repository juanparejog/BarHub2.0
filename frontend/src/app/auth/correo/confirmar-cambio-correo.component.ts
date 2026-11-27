import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { borrarFragmento, tokenDelFragmento } from './token-del-enlace';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

/** Pagina del enlace que llega al correo nuevo al cambiarlo desde el perfil. */
@Component({
  selector: 'app-confirmar-cambio-correo',
  standalone: true,
  imports: [RouterLink, TraducirPipe],
  templateUrl: './confirmar-cambio-correo.component.html',
  styleUrls: ['./cuenta-correo.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class ConfirmarCambioCorreoComponent implements OnInit {
  private readonly idiomas = inject(IdiomaService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly authService = inject(AuthService);

  estado: 'comprobando' | 'confirmado' | 'error' = 'comprobando';
  mensaje = '';
  conSesion = false;

  ngOnInit(): void {
    this.conSesion = this.authService.isAuthenticated();
    const token = tokenDelFragmento(this.route.snapshot.fragment);
    borrarFragmento(this.location);
    if (!token) {
      this.estado = 'error';
      this.mensaje = this.idiomas.t('correo.incompleto');
      return;
    }
    this.authService.confirmarCambioCorreo(token).subscribe({
      next: respuesta => {
        this.estado = 'confirmado';
        this.mensaje = this.idiomas.delServidor(respuesta.message, 'correo.cambioConfirmado');
      },
      error: err => {
        this.estado = 'error';
        this.mensaje = this.idiomas.delServidor(err?.error?.message, 'correo.errorConfirmar');
      }
    });
  }
}
