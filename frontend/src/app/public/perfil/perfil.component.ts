import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../admin/pages/usuarios/services/usuario';
import { Usuario } from '../../admin/pages/usuarios/interface/usuario';

@Component({
    selector: 'app-perfil',
    templateUrl: './perfil.component.html',
    styleUrls: ['./perfil.component.css'],
    standalone: false
})
export class PerfilComponent implements OnInit {
  perfilForm!: FormGroup;
  passwordForm!: FormGroup;
  mensajeExito: string = '';
  mensajeError: string = '';
  usuarioId!: number;
  usuarioActual!: Usuario;

  mostrarModalImagen: boolean = false;
  isDragging: boolean = false;
  archivoSeleccionado: File | null = null;
  imagenPreview: string | ArrayBuffer | null = null;
  nombreArchivoRenombrado: string = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly usuarioService: UsuarioService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    const idGuardado = localStorage.getItem('usuarioId') || localStorage.getItem('id');
    
    if (idGuardado) {
      this.usuarioId = Number(idGuardado);
      this.cargarDatosUsuario();
    } else {
      this.mensajeError = 'No se ha encontrado una sesión activa. Por favor, inicia sesión de nuevo.';
      console.warn('No se encontró el ID de usuario en el localStorage.');
    }
  }

  initForm(): void {
    this.passwordForm = this.fb.group({
      passwordActual: [''],
      passwordNueva: [''],
      passwordRepetir: ['']
    });

    this.perfilForm = this.fb.group({
      username: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      nombre: ['', [Validators.required, Validators.maxLength(50)]],
      apellido1: ['', [Validators.required, Validators.maxLength(50)]],
      apellido2: [''],
      imagen: [''],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
      calle: ['', [Validators.required, Validators.minLength(5)]],
      tipoVivienda: ['piso', Validators.required],
      portalNum: [''],
      pisoNum: [''],
      puerta: [''],
      urbanizacionNombre: [''],
      casaNum: [''],
      codigoPostal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      instruccionesEntrega: ['']
    });

    this.perfilForm.get('tipoVivienda')?.valueChanges.subscribe((tipo: string) => {
      this.actualizarValidacionesVivienda(tipo);
    });

    this.actualizarValidacionesVivienda('piso');
  }

  actualizarValidacionesVivienda(tipo: string): void {
    const portal = this.perfilForm.get('portalNum');
    const piso = this.perfilForm.get('pisoNum');
    const puerta = this.perfilForm.get('puerta');
    const urbNombre = this.perfilForm.get('urbanizacionNombre');
    const casaNum = this.perfilForm.get('casaNum');

    portal?.clearValidators();
    piso?.clearValidators();
    puerta?.clearValidators();
    urbNombre?.clearValidators();
    casaNum?.clearValidators();

    const t = tipo?.toLowerCase();
    if (t === 'piso') {
      portal?.setValidators([Validators.required]);
      piso?.setValidators([Validators.required]);
      puerta?.setValidators([Validators.required]);
    } else if (t === 'urbanizacion') {
      urbNombre?.setValidators([Validators.required]);
      casaNum?.setValidators([Validators.required]);
    } else if (t === 'casa') {
      casaNum?.setValidators([Validators.required]);
    }

    portal?.updateValueAndValidity();
    piso?.updateValueAndValidity();
    puerta?.updateValueAndValidity();
    urbNombre?.updateValueAndValidity();
    casaNum?.updateValueAndValidity();
  }

  cargarDatosUsuario(): void {
    this.usuarioService.getId(this.usuarioId).subscribe({
      next: (usuario: Usuario) => {
        this.usuarioActual = usuario;

        this.perfilForm.patchValue({
          username: usuario.username || '',
          email: usuario.email || '',
          nombre: usuario.nombre || '',
          apellido1: usuario.apellido1 || '',
          apellido2: usuario.apellido2 || '',
          imagen: usuario.imagen || '',
          telefono: usuario.telefono || '',
          calle: usuario.calle || '',
          tipoVivienda: usuario.tipoVivienda ? usuario.tipoVivienda.toLowerCase() : 'piso',
          portalNum: usuario.portalNum || '',
          pisoNum: usuario.pisoNum || '',
          puerta: usuario.puerta || '',
          urbanizacionNombre: usuario.urbanizacionNombre || '',
          casaNum: usuario.casaNum || '',
          codigoPostal: usuario.codigoPostal || '',
          instruccionesEntrega: usuario.instruccionesEntrega || ''
        });

        if (usuario.imagen) {
          this.imagenPreview = `assets/images/usuarios/${usuario.imagen}`;
          this.nombreArchivoRenombrado = usuario.imagen;
        }
      },
      error: (err) => {
        console.error('Error al cargar el usuario:', err);
        this.mensajeError = 'No se pudieron cargar los datos del perfil desde el servidor.';
      }
    });
  }

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

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivo(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  private procesarArchivo(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.mensajeError = 'Por favor, selecciona un archivo de imagen válido.';
      return;
    }

    this.archivoSeleccionado = file;
    this.actualizarNombreArchivo();

    const reader = new FileReader();
    reader.onload = () => this.imagenPreview = reader.result;
    reader.readAsDataURL(file);
  }

  private obtenerArchivoRenombrado(): File | null {
    if (!this.archivoSeleccionado) return null;

    const usernameForm = this.perfilForm.get('username')?.value || 'usuario';
    
    const nombreLimpio = usernameForm
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const extension = this.archivoSeleccionado.name.split('.').pop() || 'jpg';
    this.nombreArchivoRenombrado = `${nombreLimpio}.${extension}`;

    return new File([this.archivoSeleccionado], this.nombreArchivoRenombrado, {
      type: this.archivoSeleccionado.type
    });
  }

  private actualizarNombreArchivo(): void {
    if (this.archivoSeleccionado) {
      this.obtenerArchivoRenombrado();
    }
  }

  guardarNuevaImagen(): void {
    if (this.archivoSeleccionado) {
      this.mensajeExito = '¡Imagen seleccionada! Pulsa "Guardar Cambios" para aplicarla.';
      this.cerrarModalImagen();
      setTimeout(() => this.mensajeExito = '', 4000);
    }
  }

  getImagenPerfilUrl(): string {
    if (this.imagenPreview && typeof this.imagenPreview === 'string') {
      return this.imagenPreview;
    }
    const username = this.perfilForm?.get('username')?.value || this.usuarioActual?.username;
    if (username) {
      return `assets/images/usuarios/${username}.jpg`;
    }
    return 'assets/images/usuarios/default.jpg';
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/usuarios/default.jpg';
  }

  abrirModalImagen(): void {
    this.mostrarModalImagen = true;
  }

  cerrarModalImagen(): void {
    this.mostrarModalImagen = false;
  }

  /** Devuelve el mensaje de error de la seccion de contrasena, o null si esta bien (o vacia). */
  private validarPassword(): string | null {
    const { passwordActual, passwordNueva, passwordRepetir } = this.passwordForm.value;
    if (!passwordActual && !passwordNueva && !passwordRepetir) {
      return null;
    }
    if (!passwordActual) {
      return 'Indica tu contraseña actual para cambiarla.';
    }
    if (!passwordNueva || passwordNueva.length < 6 || passwordNueva.length > 40) {
      return 'La nueva contraseña debe tener entre 6 y 40 caracteres.';
    }
    if (passwordNueva !== passwordRepetir) {
      return 'Las contraseñas nuevas no coinciden.';
    }
    return null;
  }

  private mensajeDeErrorServidor(err: any): string {
    if (err?.status === 400) {
      const m = err.error?.message ?? err.error?.mensaje ?? err.error?.error;
      if (typeof m === 'string' && m) {
        return m;
      }
    }
    return 'Ocurrió un error al actualizar los datos.';
  }

  guardarPerfil(): void {
    this.mensajeError = '';
    if (this.perfilForm.valid) {
      const errorPassword = this.validarPassword();
      if (errorPassword) {
        this.mensajeError = errorPassword;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const archivoFinal = this.obtenerArchivoRenombrado();
      const nombreImagenFinal = archivoFinal ? archivoFinal.name : (this.usuarioActual?.imagen || this.perfilForm.value.imagen);

      const formValues = this.perfilForm.getRawValue();

      const usuarioActualizado: Usuario = {
        ...this.usuarioActual,
        id: this.usuarioId,
        username: formValues.username,
        email: formValues.email,
        password: this.passwordForm.value.passwordNueva || '',
        passwordActual: this.passwordForm.value.passwordActual || undefined,
        nombre: formValues.nombre,
        apellido1: formValues.apellido1,
        apellido2: formValues.apellido2,
        imagen: nombreImagenFinal,
        telefono: formValues.telefono,
        calle: formValues.calle,
        tipoVivienda: formValues.tipoVivienda,
        portalNum: formValues.portalNum,  
        pisoNum: formValues.pisoNum,
        puerta: formValues.puerta,
        urbanizacionNombre: formValues.urbanizacionNombre,
        casaNum: formValues.casaNum,
        codigoPostal: formValues.codigoPostal,
        instruccionesEntrega: formValues.instruccionesEntrega
      };

      this.usuarioService.put(usuarioActualizado, archivoFinal).subscribe({
        next: (response) => {
          this.usuarioActual = response;
          if (response.imagen) {
            localStorage.setItem('imagen', `assets/images/usuarios/${response.imagen}`);
          }
          void this.router.navigate(['/home']).then(() => {
            window.location.reload();
          });
        },
        error: (err) => {
          console.error('Error al actualizar el perfil:', err);
          this.mensajeError = this.mensajeDeErrorServidor(err);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

    } else {
      this.perfilForm.markAllAsTouched();
      const etiquetas: Record<string, string> = {
        email: 'correo', nombre: 'nombre', apellido1: 'primer apellido',
        telefono: 'teléfono (9 dígitos)', codigoPostal: 'código postal (5 dígitos)',
        calle: 'calle (mínimo 5 caracteres)', portalNum: 'portal', pisoNum: 'piso',
        puerta: 'puerta', urbanizacionNombre: 'urbanización', casaNum: 'número de casa'
      };
      const faltan = Object.keys(this.perfilForm.controls)
        .filter(k => this.perfilForm.get(k)?.invalid)
        .map(k => etiquetas[k] || k);
      this.mensajeError = 'Revisa los campos obligatorios: ' + faltan.join(', ') + '.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}   