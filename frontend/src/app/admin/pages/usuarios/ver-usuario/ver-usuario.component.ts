import { Component, OnInit } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Usuario } from '../interface/usuario';
import { UsuarioService } from '../services/usuario';

@Component({
  selector: 'app-ver-usuario',
  templateUrl: './ver-usuario.component.html'
})
export class VerUsuarioComponent implements OnInit {

  usuario!: Usuario;

  constructor(
    private usuarioService: UsuarioService,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarUsuario();
  }
  
  cargarUsuario() {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => {
          return this.usuarioService.getId(id);
        }),
      )
      .subscribe({
        next: (usuario) => {
          this.usuario = usuario;
          console.log('Usuario cargado:', this.usuario);
        },
        error: (error) => {
          console.error('Error al cargar el usuario:', error);
        }
      });
  }
}