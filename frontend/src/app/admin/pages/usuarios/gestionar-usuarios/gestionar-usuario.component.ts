import { paginar } from 'src/app/shared/paginador/paginar';
import { IMAGEN_USUARIO_POR_DEFECTO, ponerImagenPorDefecto } from '../../../../shared/imagen-por-defecto';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { UsuarioService } from '../services/usuario';
import { Usuario } from '../interface/usuario';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
    selector: 'app-gestionar-usuario',
    templateUrl: './gestionar-usuario.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarUsuarioComponent implements OnInit {
  
  usuarios: Usuario[] = [];

  searchTerm: string = '';

  /** Página del listado (la primera es la 1) y filas por página. */
  pagina = 1;
  tamano = 25;

  sortColumn: 'username' | 'email' | 'roles' = 'username';
  sortDirection: 'asc' | 'desc' = 'asc';

  mostrarModalEliminar: boolean = false;
  usuarioAEliminar: Usuario | null = null;

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.usuarioService.get().subscribe({
      next: (usuarios) => {
        console.log('Usuarios cargados:', usuarios);
        this.usuarios = usuarios;
      },
      error: (err) => {
        console.error('Error cargando usuarios:', err);
        this.dialogService.mostrarToast('Error al cargar usuarios');
      }
    });
  }

  sortBy(column: 'username' | 'email' | 'roles'): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  obtenerImagenUsuario(usuario: Usuario): string {
    if (usuario.imagen) {
      if (usuario.imagen.startsWith('assets/') || usuario.imagen.startsWith('http')) {
        return usuario.imagen;
      }
      return `assets/images/usuarios/${usuario.imagen}`;
    }
    
    return `assets/images/usuarios/${usuario.username}.jpg`;
  }

  obtenerApellidos(usuario: Usuario): string {
    return [usuario.apellido1, usuario.apellido2].filter(Boolean).join(' ');
  }

  obtenerNombreCompleto(usuario: Usuario): string {
    const apellidos = this.obtenerApellidos(usuario);
    const nombre = usuario.nombre || '';
    const completo = `${nombre} ${apellidos}`.trim();
    return completo.length > 0 ? completo : usuario.username;
  }

  /** Las filas de la página actual, tras buscar y ordenar. */
  get usuariosPagina(): Usuario[] {
    return paginar(this.usuariosFiltrados, this.pagina, this.tamano);
  }

  get usuariosFiltrados(): Usuario[] {
    if (!this.usuarios) return [];
    
    const term = this.searchTerm.toLowerCase().trim();

    let result = this.usuarios.filter(usuario => {
      const matchUsername = usuario.username?.toLowerCase().includes(term) ?? false;
      const matchEmail = usuario.email?.toLowerCase().includes(term) ?? false;
      const matchNombre = usuario.nombre?.toLowerCase().includes(term) ?? false;
      const matchApellido1 = usuario.apellido1?.toLowerCase().includes(term) ?? false;
      const matchApellido2 = usuario.apellido2?.toLowerCase().includes(term) ?? false;
      const matchRoles = usuario.roles?.some(rol =>
        this.formatearNombreRol(rol.nombre).toLowerCase().includes(term) ||
        rol.nombre?.toLowerCase().includes(term)
      ) ?? false;

      return matchUsername || matchEmail || matchNombre || matchApellido1 || matchApellido2 || matchRoles;
    });

    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (this.sortColumn === 'roles') {
        valA = (a.roles || []).map(r => this.formatearNombreRol(r.nombre)).sort((x, y) => x.localeCompare(y)).join(', ');
        valB = (b.roles || []).map(r => this.formatearNombreRol(r.nombre)).sort((x, y) => x.localeCompare(y)).join(', ');
      } else {
        valA = (a[this.sortColumn] || '').toString().toLowerCase();
        valB = (b[this.sortColumn] || '').toString().toLowerCase();
      }

      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
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

  borrarUsuario(usuario: Usuario): void {
    this.usuarioAEliminar = usuario;  
    this.mostrarModalEliminar = true;
  }

  /** El administrador no puede quitarse la suya desde el listado. */
  esUsuarioActual(usuario: Usuario): boolean {
    return usuario.id != null && String(usuario.id) === localStorage.getItem('usuarioId');
  }

  restablecerDosFactores(usuario: Usuario): void {
    if (!usuario.id) return;
    const id = usuario.id;
    this.dialogService.solicitarConfirmacion(
      `${usuario.username} tendrá que configurar la verificación en dos pasos de nuevo al iniciar sesión, ` +
      'y se cerrarán todas sus sesiones abiertas. Hazlo solo si ha perdido el acceso a su app de autenticación.',
      'Restablecer verificación en dos pasos',
      () => this.usuarioService.restablecerDosFactores(id).subscribe({
        next: () => {
          this.dialogService.mostrarToast(`Verificación en dos pasos de ${usuario.username} restablecida`);
          this.cargarUsuarios();
        },
        error: (err) => {
          // Si se cancela la confirmación del código no hace falta otro aviso
          if (err?.error?.code !== 'REAUTENTICACION_REQUERIDA') {
            this.dialogService.mostrarToast(err?.error?.message ?? 'No se pudo restablecer la verificación en dos pasos');
          }
        }
      })
    );
  }

  confirmarEliminacion(): void {
    if (!this.usuarioAEliminar?.id) return;

    this.usuarioService.del(this.usuarioAEliminar.id).subscribe({
      next: () => {
        this.dialogService.mostrarToast('Usuario eliminado correctamente');
        this.cargarUsuarios();
        this.cerrarModal();
      },
      error: (err) => {
        console.error('Error eliminando usuario:', err);
        this.dialogService.mostrarToast('Error al eliminar el usuario');
        this.cerrarModal();
      }
    });
  }

  cerrarModal(): void {
    this.mostrarModalEliminar = false;
    this.usuarioAEliminar = null;
  }

  onImgError(event: Event): void {
    ponerImagenPorDefecto(event, IMAGEN_USUARIO_POR_DEFECTO);
  }
}