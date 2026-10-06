import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap } from "rxjs";
import { RolService } from "../services/rol";
import { UsuarioService } from "../services/usuario";
import { Usuario, Rol } from "../interface/usuario";

function minimoUnRolValidator(control: AbstractControl): ValidationErrors | null {
  const roles = control.value;
  return Array.isArray(roles) && roles.length > 0 ? null : { requiereRol: true };
}

@Component({
  selector: 'app-editar-usuario',
  templateUrl: './editar-usuario.component.html',
})
export class EditarUsuarioComponent implements OnInit {

  formulario: FormGroup = this.fb.group({
    id: [null],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    roles: [[], [minimoUnRolValidator]]
  });

  editar: boolean = false;
  rolesDisponibles: Rol[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private fb: FormBuilder,
    private router: Router,
    private usuarioService: UsuarioService,
    private rolService: RolService
  ) { }

  ngOnInit(): void {
    this.cargarRoles();
    if (this.router.url.includes('editar')) {
      this.cargarUsuario();
      this.editar = true;
    }
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe(roles => {
      this.rolesDisponibles = roles;
    });
  }

  guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const idActual = this.formulario.get('id')?.value;
    if (idActual && idActual > 0) {
      this.editarUsuario();
    } else {
      this.crearUsuario();
    }
  }

  cargarUsuario() {
    this.activatedRoute.params
      .pipe(switchMap(({ id }) => this.usuarioService.getId(id)))
      .subscribe({
        next: (usuario: Usuario) => {
          this.formulario.reset({
            ...usuario,
            roles: usuario.roles || []
          });
        },
        error: () => this.router.navigate(['/admin/gestionar-usuarios'])
      });
  }

  crearUsuario() {
    const rawVal = this.formulario.getRawValue();
    
    const nuevoUsuario: Usuario = {
      username: rawVal.username,
      email: rawVal.email,
      password: rawVal.password,
      roles: rawVal.roles
    };

    this.usuarioService.post(nuevoUsuario).subscribe({
      next: () => this.router.navigate(['/admin/gestionar-usuarios']),
      error: (err) => console.error('Error al crear el usuario:', err)
    });
  }

  editarUsuario() {
    const datosUsuario = this.formulario.getRawValue();
  
    if (!datosUsuario.password) {
      delete datosUsuario.password;
    }
  
    this.usuarioService.put(datosUsuario).subscribe({
      next: () => {
        this.router.navigate(['/admin/gestionar-usuarios']);
      },
      error: (err) => {
        console.error('Error en la petición PUT:', err);
      }
    });
  }

  toggleRol(rol: Rol): void {
    const rolesActuales: Rol[] = [...(this.formulario.value.roles || [])];
    
    const index = rolesActuales.findIndex(r => 
      (r.id !== undefined && r.id === rol.id) || 
      (r.nombre && r.nombre === rol.nombre)
    );

    if (index !== -1) {
      if (rolesActuales.length === 1) {
        alert('El usuario debe conservar al menos un rol.');
        return;
      }
      rolesActuales.splice(index, 1);
    } else {
      rolesActuales.push(rol);
    }

    const controlRoles = this.formulario.get('roles');
    controlRoles?.setValue(rolesActuales);
    controlRoles?.markAsDirty();
    controlRoles?.updateValueAndValidity();
  }

  isRoleChecked(rol: Rol): boolean {
    const roles: Rol[] = this.formulario.value.roles || [];
    return roles.some(r => 
      (r.id !== undefined && r.id === rol.id) || 
      (r.nombre && r.nombre === rol.nombre)
    );
  }

  formatearNombreRol(nombre: string): string {
    return nombre ? nombre.replace('ROLE_', '') : '';
  }

  getRolClass(nombre: string): string {
    if (!nombre) return '';
    if (nombre.includes('ADMIN')) return 'rol-admin';
    if (nombre.includes('CLIENTE')) return 'rol-cliente';
    if (nombre.includes('EMPLEADO')) return 'rol-empleado';
    return '';
  }
}