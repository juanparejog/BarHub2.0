import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CajaService } from './services/caja.service';
import { Caja } from './interface/caja';
import { DialogService } from 'src/app/main/services/shared/services/dialog.service';

@Component({
  selector: 'app-gestionar-caja',
  templateUrl: './gestionar-caja.component.html'
})
export class GestionarCajaComponent implements OnInit {

  cajaActual: Caja | null = null;
  historialCajas: Caja[] = [];
  cargando: boolean = true;

  // Formularios
  formApertura: FormGroup;
  formCierre: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cajaService: CajaService,
    private dialogService: DialogService
  ) {
    this.formApertura = this.fb.group({
      montoInicial: [150.00, [Validators.required, Validators.min(0)]],
      observaciones: ['']
    });

    this.formCierre = this.fb.group({
      efectivoReal: [null, [Validators.required, Validators.min(0)]],
      observaciones: ['']
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.obtenerCajaActual();
    this.cargarHistorial();
  }

  obtenerCajaActual(): void {
    this.cajaService.obtenerCajaActual().subscribe({
      next: (caja) => {
        this.cajaActual = caja;
        this.cargando = false;
      },
      error: () => {
        // Si responde con error/404, significa que no hay ninguna caja abierta
        this.cajaActual = null;
        this.cargando = false;
      }
    });
  }

  cargarHistorial(): void {
    this.cajaService.obtenerHistorial().subscribe({
      next: (historial) => {
        this.historialCajas = historial;
      },
      error: (err) => {
        console.error('Error al cargar el historial de cajas:', err);
      }
    });
  }

  abrirCaja(): void {
    if (this.formApertura.invalid) {
      this.formApertura.markAllAsTouched();
      return;
    }

    this.cajaService.abrirCaja(this.formApertura.value).subscribe({
      next: (caja) => {
        this.dialogService.mostrarToast('Caja abierta correctamente');
        this.cajaActual = caja;
        this.formApertura.reset({ montoInicial: 150.00, observaciones: '' });
        this.cargarHistorial();
      },
      error: (err) => {
        console.error('Error al abrir la caja:', err);
        this.dialogService.mostrarToast(err.error?.message || 'Error al abrir la caja');
      }
    });
  }

  cerrarCaja(): void {
    if (this.formCierre.invalid) {
      this.formCierre.markAllAsTouched();
      return;
    }

    this.cajaService.cerrarCaja(this.formCierre.value).subscribe({
      next: () => {
        this.dialogService.mostrarToast('Caja cerrada y arqueo completado correctamente');
        this.cajaActual = null;
        this.formCierre.reset();
        this.cargarDatos();
      },
      error: (err) => {
        console.error('Error al cerrar la caja:', err);
        this.dialogService.mostrarToast(err.error?.message || 'Error al realizar el cierre de caja');
      }
    });
  }

  /**
   * Cálculo dinámico del descuadre/diferencia antes de enviar el formulario
   */
  get diferenciaCalculada(): number {
    if (!this.cajaActual || this.formCierre.get('efectivoReal')?.value === null) {
      return 0;
    }
    const efectivoReal = Number(this.formCierre.get('efectivoReal')?.value) || 0;
    const efectivoEsperado = this.cajaActual.efectivoEsperado || (this.cajaActual.montoInicial + (this.cajaActual.ventasEfectivo || 0));
    return efectivoReal - efectivoEsperado;
  }
}