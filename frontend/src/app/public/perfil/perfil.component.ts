import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsuarioService } from '../../admin/pages/usuarios/services/usuario';
import { Usuario } from '../../admin/pages/usuarios/interface/usuario';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  perfilForm!: FormGroup;
  mensajeExito: string = '';
  mensajeError: string = '';
  usuarioId!: number;
  usuarioActual!: Usuario;

  mostrarModalImagen: boolean = false;
  imagenPreview: string = '';
  archivoSeleccionado: File | null = null;
  isDragging: boolean = false;

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService
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
    this.perfilForm = this.fb.group({
      username: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      nombre: ['', [Validators.required, Validators.maxLength(50)]],
      apellido1: ['', [Validators.required, Validators.maxLength(50)]],
      apellido2: [''],
      imagen: [''],

      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{9,}$/)]],
      calle: ['', [Validators.required, Validators.minLength(5)]],
      tipoVivienda: ['piso', Validators.required],
      portalNum: [''],
      pisoNum: [''],
      puerta: [''],
      urbanizacionNombre: [''],
      casaNum: [''],
      codigoPostal: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
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
      },
      error: (err) => {
        console.error('Error al cargar el usuario:', err);
        this.mensajeError = 'No se pudieron cargar los datos del perfil desde el servidor.';
      }
    });
  }

  guardarNuevaImagen(): void {
    if (this.imagenPreview) {
      this.perfilForm.patchValue({ imagen: this.imagenPreview });
      this.mensajeExito = '¡Imagen actualizada! Pulsa "Guardar Cambios" para aplicar todo.';
      this.cerrarModalImagen();
      setTimeout(() => this.mensajeExito = '', 4000);
    }
  }

  getImagenPerfilUrl(): string {
    const imagenBD = this.perfilForm?.get('imagen')?.value || this.usuarioActual?.imagen;
    const username = this.perfilForm?.get('username')?.value || this.usuarioActual?.username;

    if (imagenBD) {
      return imagenBD;
    }
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
    this.archivoSeleccionado = null;
    this.imagenPreview = '';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.procesarArchivo(file);
    }
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
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.procesarArchivo(files[0]);
    }
  }

  procesarArchivo(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.mensajeError = 'Por favor, selecciona un archivo de imagen válido.';
      return;
    }
    
    const username = this.perfilForm.get('username')?.value || 'usuario';
    const archivoRenombrado = new File([file], `${username}.jpg`, { type: file.type });
    this.archivoSeleccionado = archivoRenombrado;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagenPreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  guardarPerfil(): void {
    if (this.perfilForm.valid) {
      const formValues = this.perfilForm.getRawValue();

      const usuarioActualizado: Usuario = {
        ...(this.usuarioActual || {}),
        id: this.usuarioId,
        username: formValues.username,
        email: formValues.email,
        password: this.usuarioActual?.password || '',
        nombre: formValues.nombre,
        apellido1: formValues.apellido1,
        apellido2: formValues.apellido2,
        imagen: formValues.imagen,
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

      this.usuarioService.put(usuarioActualizado).subscribe({
        next: (response) => {
          this.usuarioActual = response;
          this.mensajeExito = '¡Perfil y datos guardados correctamente en el servidor!';
          this.mensajeError = '';
          setTimeout(() => this.mensajeExito = '', 4000);
        },
        error: (err) => {
          console.error('Error al actualizar el perfil:', err);
          this.mensajeError = 'Ocurrió un error al actualizar los datos.';
        }
      });

    } else {
      this.perfilForm.markAllAsTouched();
    }
  }
}