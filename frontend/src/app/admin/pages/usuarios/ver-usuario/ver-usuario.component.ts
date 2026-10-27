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
    private readonly usuarioService: UsuarioService,
    private readonly activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.cargarUsuario();
  }

  cargarUsuario(): void {
    this.activatedRoute.params
      .pipe(
        switchMap(({ id }) => this.usuarioService.getId(id)),
      )
      .subscribe({
        next: (usuario) => {
          this.usuario = usuario;
        },
        error: (error) => {
          console.error('Error al cargar el usuario:', error);
        }
      });
  }

  /* ==========================================
     MÉTODOS AUXILIARES DE FORMATEO Y VISTA
     ========================================== */
  obtenerApellidos(): string {
    if (!this.usuario) return '';
    return [this.usuario.apellido1, this.usuario.apellido2].filter(Boolean).join(' ');
  }

  obtenerNombreCompleto(): string {
    if (!this.usuario) return '';
    const apellidos = this.obtenerApellidos();
    const nombre = this.usuario.nombre || '';
    const completo = `${nombre} ${apellidos}`.trim();
    return completo.length > 0 ? completo : this.usuario.username;
  }

  obtenerImagenUsuario(): string {
    if (!this.usuario) return '';
    if (this.usuario.imagen) {
      if (this.usuario.imagen.startsWith('assets/') || this.usuario.imagen.startsWith('http') || this.usuario.imagen.startsWith('data:')) {
        return this.usuario.imagen;
      }
      return `assets/images/usuarios/${this.usuario.imagen}`;
    }
    return `assets/images/usuarios/${this.usuario.username}.jpg`;
  }

  manejarErrorImagen(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.style.display = 'none';
    const parent = imgElement.parentElement;
    if (parent) {
      const placeholder = parent.querySelector('.avatar-placeholder-fallback') as HTMLElement;
      if (placeholder) {
        placeholder.classList.remove('d-none');
        placeholder.classList.add('d-flex');
      }
    }
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
}