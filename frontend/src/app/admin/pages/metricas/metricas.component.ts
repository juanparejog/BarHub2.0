import { Component, OnInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { forkJoin } from 'rxjs';
import { PedidoService } from '../pedidos/services/pedido';
import { DetallesService } from '../detalles_pedidos/services/detalle';
import { ProductoService } from '../productos/services/producto';
import { Pedido } from '../pedidos/interface/pedido'; 
import { DetallesPedido } from '../detalles_pedidos/interface/detalle';
import { Producto } from '../productos/interface/producto';
import Chart from 'chart.js/auto';

export interface ProductoRanking {
  nombre: string;
  cantidad: number;
  categoria?: string;
}

@Component({
  selector: 'app-metricas',
  templateUrl: './metricas.component.html',
})
export class MetricasComponent implements OnInit, OnDestroy {
  @ViewChild('ingresosChartCanvas') ingresosChartCanvas!: ElementRef;
  @ViewChild('tiposChartCanvas') tiposChartCanvas!: ElementRef;
  @ViewChild('productosChartCanvas') productosChartCanvas!: ElementRef;

  todosLosPedidos: Pedido[] = [];
  cargando: boolean = true;
  rangoActual: string = 'lifetime';

  categoriaActiva: 'todas' | 'dinero' | 'productos' | 'tipos' = 'todas';

  // NUEVO: Filtro secundario de categorías de producto
  subcategoriaProducto: string = 'todas';

  // Cifras Calculadas
  totalIngresos: number = 0;
  totalPedidos: number = 0;
  ticketPromedio: number = 0;
  pedidosDomicilio: number = 0;
  pedidosRecoger: number = 0;
  pedidosMesa: number = 0;
  productoEstrella: string = '';
  
  // Rankings de productos
  todosLosProductosRanking: ProductoRanking[] = [];
  productosRanking: ProductoRanking[] = [];

  // Datos para la gráfica temporal X-Y
  labelsEvolucion: string[] = [];
  datosEvolucion: number[] = [];

  // Instancias de Charts
  ingresosChart: Chart | null = null;
  tiposChart: Chart | null = null;
  productosChart: Chart | null = null;

  rangos = [
    { key: 'dia', label: 'Hoy' },
    { key: 'semana', label: 'Esta Semana' },
    { key: 'mes', label: 'Este Mes' },
    { key: 'anio', label: 'Este Año' },
    { key: 'lifetime', label: 'Histórico' }
  ];

  constructor(
    private pedidoService: PedidoService,
    private detallesService: DetallesService,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    this.obtenerDatos();
  }

  ngOnDestroy(): void {
    this.destruirGraficas();
  }

  destruirGraficas(): void {
    if (this.ingresosChart) this.ingresosChart.destroy();
    if (this.tiposChart) this.tiposChart.destroy();
    if (this.productosChart) this.productosChart.destroy();
  }

  cambiarCategoria(categoria: 'todas' | 'dinero' | 'productos' | 'tipos'): void {
    this.categoriaActiva = categoria;
    setTimeout(() => this.renderizarGraficas(), 50);
  }

  // NUEVO: Cambiar filtro de categoría de producto (Bebidas, Tapas, etc.)
  filtrarSubcategoria(subcat: string): void {
    this.subcategoriaProducto = subcat;
    this.aplicarFiltroSubcategoria();
  }

  aplicarFiltroSubcategoria(): void {
    if (this.subcategoriaProducto === 'todas') {
      this.productosRanking = [...this.todosLosProductosRanking];
    } else {
      this.productosRanking = this.todosLosProductosRanking.filter(p => 
        (p.categoria || '').toLowerCase().includes(this.subcategoriaProducto.toLowerCase())
      );
    }
  }

  obtenerDatos(): void {
    this.cargando = true;

    forkJoin({
      pedidos: this.pedidoService.get(),
      detalles: this.detallesService.get(),
      productos: this.productoService.get()
    }).subscribe({
      next: ({ pedidos, detalles, productos }) => {
        const mapaProductos = new Map<number, Producto>();
        (productos || []).forEach(p => {
          if (p.id !== undefined) mapaProductos.set(p.id, p);
        });

        const mapaDetallesPorPedido = new Map<number, DetallesPedido[]>();
        (detalles || []).forEach(d => {
          if (d.id_producto && mapaProductos.has(d.id_producto)) {
            d.producto = mapaProductos.get(d.id_producto);
          }
          const idPedido = d.id_pedido || d.pedido?.id;
          if (idPedido) {
            const lista = mapaDetallesPorPedido.get(idPedido) || [];
            lista.push(d);
            mapaDetallesPorPedido.set(idPedido, lista);
          }
        });

        this.todosLosPedidos = (pedidos || []).map(p => {
          if (p.id && mapaDetallesPorPedido.has(p.id)) {
            p.detalles = mapaDetallesPorPedido.get(p.id);
          } else if (!p.detalles) {
            p.detalles = [];
          }
          return p;
        });

        this.calcularMetricas();
        this.cargando = false;
      },
      error: () => {
        this.pedidoService.get().subscribe({
          next: (pedidos) => {
            this.todosLosPedidos = pedidos || [];
            this.calcularMetricas();
            this.cargando = false;
          },
          error: () => this.cargando = false
        });
      }
    });
  }

  cambiarRango(rangoKey: string): void {
    if (this.rangoActual === rangoKey) return;
    this.rangoActual = rangoKey;
    this.calcularMetricas();
  }

  extraerFecha(p: Pedido): Date | null {
    const rawFecha = p.fecha || (p as any).created_at || (p as any).createdAt;
    if (!rawFecha) return null;

    // Si viene como array de números desde Java (LocalDateTime)
    if (Array.isArray(rawFecha)) {
      return new Date(rawFecha[0], rawFecha[1] - 1, rawFecha[2], rawFecha[3] || 0, rawFecha[4] || 0, rawFecha[5] || 0);
    }

    // Reemplazar espacios por 'T' para compatibilidad total con formatos SQL/ISO en todos los navegadores
    const fechaStr = typeof rawFecha === 'string' ? rawFecha.replace(' ', 'T') : rawFecha;
    const d = new Date(fechaStr);
    
    return isNaN(d.getTime()) ? null : d;
  }

  calcularMetricas(): void {
    const ahora = new Date();

    const pedidosFiltrados = this.todosLosPedidos.filter(p => {
      if (this.rangoActual === 'lifetime') return true;

      const fechaP = this.extraerFecha(p);
      if (!fechaP) return true;

      switch (this.rangoActual) {
        case 'dia':
          return fechaP.toDateString() === ahora.toDateString();

        case 'semana': {
          const inicioSemana = new Date(ahora);
          const diaSemana = ahora.getDay() === 0 ? 6 : ahora.getDay() - 1;
          inicioSemana.setDate(ahora.getDate() - diaSemana);
          inicioSemana.setHours(0, 0, 0, 0);
          return fechaP >= inicioSemana;
        }

        case 'mes':
          return fechaP.getMonth() === ahora.getMonth() && fechaP.getFullYear() === ahora.getFullYear();

        case 'anio':
          return fechaP.getFullYear() === ahora.getFullYear();

        default:
          return true;
      }
    });

    // Resetear contadores
    this.totalIngresos = 0;
    this.pedidosDomicilio = 0;
    this.pedidosRecoger = 0;
    this.pedidosMesa = 0;
    this.totalPedidos = pedidosFiltrados.length;

    const contadorProductosMap = new Map<string, { cantidad: number; categoria: string }>();
    const ingresosPorFechaMap = new Map<string, number>();

    // Ordenar pedidos por fecha para la gráfica temporal
    const pedidosOrdenados = [...pedidosFiltrados].sort((a, b) => {
      const fA = this.extraerFecha(a)?.getTime() || 0;
      const fB = this.extraerFecha(b)?.getTime() || 0;
      return fA - fB;
    });

    pedidosOrdenados.forEach(p => {
      const importe = Number(p.precio_total ?? (p as any).precioTotal ?? p.total ?? 0);
      this.totalIngresos += importe;

      // Agrupar dinero por fecha u hora según el rango seleccionado
      const fechaObj = this.extraerFecha(p);
      let claveFecha = 'Sin Hora';

      if (fechaObj) {
        if (this.rangoActual === 'dia') {
          // Si es "Hoy", muestra la hora exacta (ej: "19:27")
          claveFecha = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } else if (this.rangoActual === 'semana') {
          // Si es "Esta Semana", muestra día y hora (ej: "11/10 - 19:27")
          const diaMes = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
          const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          claveFecha = `${diaMes} - ${hora}`;
        } else {
          claveFecha = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        }
      }

      ingresosPorFechaMap.set(claveFecha, (ingresosPorFechaMap.get(claveFecha) || 0) + importe);

      // Clasificación por tipo de pedido
      const tipo = String(p.tipo_pedido ?? (p as any).tipoPedido ?? '').toLowerCase();
      if (tipo.includes('domicilio')) {
        this.pedidosDomicilio++;
      } else if (tipo.includes('recoger')) {
        this.pedidosRecoger++;
      } else if (tipo.includes('mesa') || p.id_mesa) {
        this.pedidosMesa++;
      } else {
        this.pedidosDomicilio++;
      }

      // Conteo de unidades de productos y detección de categoría
      const listaDetalles = p.detalles || [];
      if (Array.isArray(listaDetalles)) {
        listaDetalles.forEach(d => {
          const nombreProd = d.producto?.nombre || (d as any).nombreProducto || (d.id_producto ? `Producto #${d.id_producto}` : null);
          const rawCat = d.producto?.tipoProducto || (d as any).categoria || 'varios';
          const catName = typeof rawCat === 'object' && rawCat !== null ? (rawCat.nombre || rawCat.tipo || '') : String(rawCat);

          const cantidad = Number(d.cantidad || 1);
          if (nombreProd) {
            const actual = contadorProductosMap.get(nombreProd) || { cantidad: 0, categoria: catName };
            actual.cantidad += cantidad;
            if (!actual.categoria && catName) actual.categoria = catName;
            contadorProductosMap.set(nombreProd, actual);
          }
        });
      }
    });

    this.ticketPromedio = this.totalPedidos > 0 ? (this.totalIngresos / this.totalPedidos) : 0;

    this.todosLosProductosRanking = Array.from(contadorProductosMap.entries())
      .map(([nombre, item]) => ({ nombre, cantidad: item.cantidad, categoria: item.categoria }))
      .sort((a, b) => b.cantidad - a.cantidad);

    this.productoEstrella = this.todosLosProductosRanking.length > 0 ? this.todosLosProductosRanking[0].nombre : 'Sin datos';

    this.aplicarFiltroSubcategoria();

    this.labelsEvolucion = Array.from(ingresosPorFechaMap.keys());
    this.datosEvolucion = Array.from(ingresosPorFechaMap.values());

    // Seguridad para evitar que la gráfica quede vacía
    if (this.labelsEvolucion.length === 0) {
      this.labelsEvolucion = ['Sin registros'];
      this.datosEvolucion = [0];
    }

    setTimeout(() => this.renderizarGraficas(), 50);
  }

  renderizarGraficas(): void {
    this.destruirGraficas();

    // 1. GRÁFICA DE EVOLUCIÓN DINERO VS TIEMPO
    if (this.ingresosChartCanvas && (this.categoriaActiva === 'todas' || this.categoriaActiva === 'dinero')) {
      this.ingresosChart = new Chart(this.ingresosChartCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.labelsEvolucion.length > 0 ? this.labelsEvolucion : ['Inicio', 'Hoy'],
          datasets: [{
            label: 'Ingresos (€)',
            data: this.datosEvolucion.length > 0 ? this.datosEvolucion : [0, this.totalIngresos],
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#f97316',
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: 'Tiempo (Día / Período)', font: { weight: 'bold' } },
              grid: { color: '#e2e8f0' }
            },
            y: {
              title: { display: true, text: 'Ingresos (€)', font: { weight: 'bold' } },
              beginAtZero: true,
              grid: { color: '#e2e8f0' }
            }
          }
        }
      });
    }

    // 2. GRÁFICA ROSCO: MODALIDAD
    if (this.tiposChartCanvas && (this.categoriaActiva === 'todas' || this.categoriaActiva === 'tipos')) {
      this.tiposChart = new Chart(this.tiposChartCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: ['A Domicilio', 'A Recoger', 'En Mesa'],
          datasets: [{
            data: [this.pedidosDomicilio, this.pedidosRecoger, this.pedidosMesa],
            backgroundColor: ['#c084fc', '#fcd34d', '#38bdf8'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    // 3. GRÁFICA BARRAS: TOP PRODUCTOS
    if (this.productosChartCanvas && (this.categoriaActiva === 'todas' || this.categoriaActiva === 'productos')) {
      const top5 = this.todosLosProductosRanking.slice(0, 5);
      this.productosChart = new Chart(this.productosChartCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: top5.map(p => p.nombre),
          datasets: [{
            label: 'Unidades Vendidas',
            data: top5.map(p => p.cantidad),
            backgroundColor: '#4f46e5',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }
  }
}