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

  getNombreRol(rol: any): string {
    if (!rol) return '';
    if (typeof rol === 'string') return rol;
    return rol.nombre || '';
  }
  
  getRolClass(nombreRol: string | undefined): string {
    if (!nombreRol) return '';
    const rolLower = nombreRol.toLowerCase();
    
    if (rolLower.includes('admin')) {
      return 'rol-admin';
    } else if (rolLower.includes('cliente') || rolLower.includes('client')) {
      return 'rol-cliente';
    } else if (rolLower.includes('empleado') || rolLower.includes('user')) {
      return 'rol-empleado';
    }
    return '';
  }
  
  formatearNombreRol(nombreRol: string | undefined): string {
    if (!nombreRol) return '';
    return nombreRol.replace(/^ROLE_/i, '').toUpperCase();
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