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
    roles: [[], [minimoUnRolValidator]],
    nombre: [''],
    apellido1: [''],
    apellido2: [''],
    telefono: [''],
    tipoVivienda: ['piso'],
    calle: [''],
    codigoPostal: [''],
    portalNum: [''],
    pisoNum: [''],
    puerta: [''],
    urbanizacionNombre: [''],
    casaNum: [''],
    instruccionesEntrega: [''],
    imagen: ['']
  });

  editar: boolean = false;
  rolesDisponibles: Rol[] = [];

  isDragging: boolean = false;
  imagenPreview: string | null = null;

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly usuarioService: UsuarioService,
    private readonly rolService: RolService
  ) { }

  ngOnInit(): void {
    this.cargarRoles();
    if (this.router.url.includes('editar')) {
      this.editar = true;
      this.cargarUsuario();
    }
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (roles) => this.rolesDisponibles = roles,
      error: (err) => console.error('Error al cargar roles:', err)
    });
  }

  cargarUsuario(): void {
    this.activatedRoute.params
      .pipe(switchMap(({ id }) => this.usuarioService.getId(id)))
      .subscribe({
        next: (usuario: Usuario) => {
          this.formulario.patchValue({
            ...usuario,
            roles: usuario.roles || []
          });

          // Establecer la vista previa de la imagen si existe
          if (usuario.imagen) {
            this.imagenPreview = usuario.imagen.startsWith('http') || usuario.imagen.startsWith('data:') || usuario.imagen.startsWith('assets/')
              ? usuario.imagen
              : `assets/images/usuarios/${usuario.imagen}`;
          } else if (usuario.username) {
            this.imagenPreview = `assets/images/usuarios/${usuario.username}.jpg`;
          }
        },
        error: () => this.router.navigate(['/admin/gestionar-usuarios'])
      });
  }

  /* ==========================================
     DRAG AND DROP & GESTIÓN DE IMAGEN
     ========================================== */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivo(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.procesarArchivo(file);
    }
  }

  procesarArchivo(file: File): void {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;
      this.imagenPreview = base64Image;
      this.formulario.patchValue({ imagen: base64Image });
      this.formulario.markAsDirty();
    };
    reader.readAsDataURL(file);
  }

  eliminarImagen(): void {
    this.imagenPreview = null;
    this.formulario.patchValue({ imagen: '' });
    this.formulario.markAsDirty();
  }

  manejarErrorImagenPreview(): void {
    this.imagenPreview = null;
  }

  /* ==========================================
     MÉTODOS DE GUARDADO Y FORMULARIO
     ========================================== */
  guardar(): void {
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

  crearUsuario(): void {
    const rawVal = this.formulario.getRawValue();

    // Eliminar campos vacíos opcionales si fuera necesario
    const nuevoUsuario: Usuario = { ...rawVal };

    this.usuarioService.post(nuevoUsuario).subscribe({
      next: () => this.router.navigate(['/admin/gestionar-usuarios']),
      error: (err) => console.error('Error al crear el usuario:', err)
    });
  }

  editarUsuario(): void {
    const datosUsuario = this.formulario.getRawValue();

    if (!datosUsuario.password) {
      delete datosUsuario.password;
    }

    this.usuarioService.put(datosUsuario).subscribe({
      next: () => this.router.navigate(['/admin/gestionar-usuarios']),
      error: (err) => console.error('Error en la petición PUT:', err)
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
    return nombre ? nombre.replace(/^ROLE_/i, '').toUpperCase() : '';
  }

  getRolClass(nombre: string): string {
    if (!nombre) return '';
    const rolLower = nombre.toLowerCase();
    if (rolLower.includes('admin')) return 'rol-admin';
    if (rolLower.includes('cliente') || rolLower.includes('client')) return 'rol-cliente';
    if (rolLower.includes('empleado') || rolLower.includes('user')) return 'rol-empleado';
    return '';
  }
}