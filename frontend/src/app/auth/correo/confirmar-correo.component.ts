import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { borrarFragmento, tokenDelFragmento } from './token-del-enlace';

/** Pagina del enlace de confirmacion que llega por correo al registrarse. */
@Component({
  selector: 'app-confirmar-correo',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirmar-correo.component.html',
  styleUrls: ['./cuenta-correo.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class ConfirmarCorreoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly authService = inject(AuthService);

  estado: 'comprobando' | 'confirmado' | 'error' = 'comprobando';
  mensaje = '';

  ngOnInit(): void {
    const token = tokenDelFragmento(this.route.snapshot.fragment);
    borrarFragmento(this.location);
    if (!token) {
      this.estado = 'error';
      this.mensaje = 'El enlace está incompleto. Ábrelo de nuevo desde el correo.';
      return;
    }
    this.authService.confirmarCorreo(token).subscribe({
      next: respuesta => {
        this.estado = 'confirmado';
        this.mensaje = respuesta.message;
      },
      error: err => {
        this.estado = 'error';
        this.mensaje = err?.error?.message ?? 'No se pudo confirmar el correo. Inténtalo más tarde.';
      }
    });
  }
}
