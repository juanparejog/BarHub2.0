import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CajaService } from './services/caja.service';
import { Caja } from './interface/caja';
import { AvisoService } from 'src/app/shared/avisos/aviso.service';
import { paginar } from 'src/app/shared/paginador/paginar';
import { Periodo, TipoPeriodo, enPeriodo, esElActual, etiquetaPeriodo, moverReferencia, periodoDe } from './periodo';

/** Totales del historial en el periodo elegido. */
export interface ResumenCajas {
  cajas: number;
  efectivo: number;
  tarjeta: number;
  descuadre: number;
}

@Component({
    selector: 'app-gestionar-caja',
    templateUrl: './gestionar-caja.component.html',
    styleUrls: ['./gestionar-caja.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GestionarCajaComponent implements OnInit {

  cajaActual: Caja | null = null;
  historialCajas: Caja[] = [];
  cargando: boolean = true;

  /** Historial: semana, mes, año o todo, y la fecha que marca cuál (al abrir, la semana actual). */
  readonly periodos: ReadonlyArray<{ tipo: TipoPeriodo; texto: string }> = [
    { tipo: 'semana', texto: 'Semana' },
    { tipo: 'mes', texto: 'Mes' },
    { tipo: 'anio', texto: 'Año' },
    { tipo: 'todo', texto: 'Todo' }
  ];
  tipoPeriodo: TipoPeriodo = 'semana';
  referencia = new Date();
  pagina = 1;
  tamano = 10;

  // Formularios
  formApertura: FormGroup;
  formCierre: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly cajaService: CajaService,
    private readonly avisos: AvisoService
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
        // Sin caja abierta el backend responde 204 (caja = null, rama next); aqui solo llegan errores reales
        this.cajaActual = null;
        this.cargando = false;
      }
    });
  }

  cargarHistorial(): void {
    this.cajaService.obtenerHistorial().subscribe({
      next: (historial) => {
        // La más reciente primero
        this.historialCajas = [...(historial ?? [])].sort((a, b) =>
          new Date(b.fechaApertura).getTime() - new Date(a.fechaApertura).getTime());
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
        this.avisos.flotante('Caja abierta');
        this.cajaActual = caja;
        this.formApertura.reset({ montoInicial: 150.00, observaciones: '' });
        this.cargarHistorial();
      },
      error: (err) => {
        console.error('Error al abrir la caja:', err);
        this.avisos.flotante(err.error?.message || 'No se ha podido abrir la caja', 'error');
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
        this.avisos.flotante('Caja cerrada y arqueo guardado');
        this.cajaActual = null;
        this.formCierre.reset();
        this.cargarDatos();
      },
      error: (err) => {
        console.error('Error al cerrar la caja:', err);
        this.avisos.flotante(err.error?.message || 'No se ha podido cerrar la caja', 'error');
      }
    });
  }

  get periodo(): Periodo {
    return periodoDe(this.tipoPeriodo, this.referencia);
  }

  get etiquetaPeriodo(): string {
    return etiquetaPeriodo(this.periodo);
  }

  /** No se avanza más allá del periodo de hoy. */
  get esPeriodoActual(): boolean {
    return esElActual(this.periodo, new Date());
  }

  elegirPeriodo(tipo: TipoPeriodo): void {
    this.tipoPeriodo = tipo;
    this.referencia = new Date();
    this.pagina = 1;
  }

  moverPeriodo(pasos: number): void {
    if (pasos > 0 && this.esPeriodoActual) {
      return;
    }
    this.referencia = moverReferencia(this.tipoPeriodo, this.referencia, pasos);
    this.pagina = 1;
  }

  /** Cajas abiertas dentro del periodo elegido. */
  get cajasDelPeriodo(): Caja[] {
    const periodo = this.periodo;
    return this.historialCajas.filter(caja => enPeriodo(caja.fechaApertura, periodo));
  }

  get cajasPagina(): Caja[] {
    return paginar(this.cajasDelPeriodo, this.pagina, this.tamano);
  }

  get resumen(): ResumenCajas {
    return this.cajasDelPeriodo.reduce<ResumenCajas>((total, caja) => ({
      cajas: total.cajas + 1,
      efectivo: total.efectivo + (caja.ventasEfectivo || 0),
      tarjeta: total.tarjeta + (caja.ventasTarjeta || 0),
      descuadre: total.descuadre + (caja.diferencia || 0)
    }), { cajas: 0, efectivo: 0, tarjeta: 0, descuadre: 0 });
  }

  /** Si ya se ha escrito el dinero contado (para enseñar el descuadre). */
  get hayConteo(): boolean {
    const valor = this.formCierre.get('efectivoReal')?.value;
    return valor !== null && valor !== undefined && valor !== '';
  }

  /** Efectivo que debería haber en el cajón de la caja abierta. */
  get efectivoEsperado(): number {
    if (!this.cajaActual) {
      return 0;
    }
    return this.cajaActual.efectivoEsperado || (this.cajaActual.montoInicial + (this.cajaActual.ventasEfectivo || 0));
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