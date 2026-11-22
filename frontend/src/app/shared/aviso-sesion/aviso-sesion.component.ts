import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, effect, inject, viewChild
} from '@angular/core';
import { SesionAvisoService } from '../../auth/sesion-aviso.service';

/** Avisos de cierre de sesion: por inactividad (con cuenta atras) y por la duracion maxima del rol. */
@Component({
  selector: 'app-aviso-sesion',
  standalone: true,
  templateUrl: './aviso-sesion.component.html',
  styleUrls: ['./aviso-sesion.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvisoSesionComponent implements OnInit, OnDestroy {
  readonly aviso = inject(SesionAvisoService);
  private readonly botonSeguir = viewChild<ElementRef<HTMLButtonElement>>('botonSeguir');

  constructor() {
    // El foco va al boton principal en cuanto aparece el aviso (teclado y lectores de pantalla)
    effect(() => this.botonSeguir()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.aviso.iniciar();
  }

  ngOnDestroy(): void {
    this.aviso.detener();
  }
}
