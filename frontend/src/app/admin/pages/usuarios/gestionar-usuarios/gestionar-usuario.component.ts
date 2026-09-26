import { Component, OnInit } from '@angular/core';
import { UsuarioService } from '../services/usuario';
import { Usuario } from '../interface/usuario';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
  selector: 'app-gestionar-usuario',
  templateUrl: './gestionar-usuario.component.html'
})

export class GestionarUsuarioComponent implements OnInit {

  usuarios: Usuario[] = [];

  constructor(
    private usuarioService: UsuarioService,
    private dialogService: DialogService,
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

  borrarUsuario(usuario: Usuario) {
    this.dialogService.solicitarConfirmacion(
      '¿Está seguro de que desea eliminar el usuario?',
      'Eliminar usuario', 
      () => {
        this.usuarioService.del(usuario.id!).subscribe({
          next: () => {
            this.dialogService.mostrarToast('Usuario eliminado correctamente');
            this.cargarUsuarios();
          },
          error: (err) => console.error('Error eliminando usuario:', err)
        });
      }
    );
  }  
}