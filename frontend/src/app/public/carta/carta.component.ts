import { IMAGEN_PRODUCTO_POR_DEFECTO, ponerImagenPorDefecto } from '../../shared/imagen-por-defecto';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../auth/auth.service';
import { MesaService } from '../../admin/pages/mesas/services/mesa';
import { ProductoService } from '../../admin/pages/productos/services/producto';
import { UsuarioService } from '../../admin/pages/usuarios/services/usuario';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';
import { Producto } from '../../admin/pages/productos/interface/producto';
import { Usuario } from '../../admin/pages/usuarios/interface/usuario';
import { ALERGENOS, aptoSin, nombreAlergeno, textoAlergenos } from '../../shared/alergenos/alergenos';
import { IdiomaService } from '../../shared/i18n/idioma.service';
import { descripcionDe, nombreDe } from '../../shared/i18n/producto-idioma';
import { paginar } from '../../shared/paginador/paginar';

/** Alérgenos que el visitante quiere evitar, recordados en su navegador. */
const CLAVE_ALERGENOS = 'barhub.alergenosExcluidos';

export type TipoPedido = 'MESA' | 'DOMICILIO' | 'RECOGER';
export type TipoVivienda = 'piso' | 'casa' | 'urbanizacion';

interface ProductoSeleccionado {
  producto: Producto;
  cantidad: number;
}

@Component({
    selector: 'app-carta',
    templateUrl: './carta.component.html',
    styleUrls: ['./carta.component.css', './carta-productos.css', './carta-movil-oscuro.css', './carta-alergenos.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CartaComponent implements OnInit {
  public isLoggedIn = false;
  mesas: Mesa[] = [];
  productos: Producto[] = [];
  productosSeleccionados: ProductoSeleccionado[] = [];
  
  tipoPedido: TipoPedido = 'MESA';
  idMesa: number | null = null;
  mesaBloqueadaPorQr = false;

  readonly UBICACION_RECOGIDA_FIJA = {
    nombre: 'BarHub Principal',
    direccion: 'Avda Sinforiano Madroñero, 13',
    cp: '06011'
  };

  calle = '';
  tipoVivienda: TipoVivienda = 'piso';
  
  portalNum = '';
  pisoNum = '';
  puerta = '';

  casaNum = '';
  urbanizacionNombre = '';

  codigoPostal = '';
  telefonoContacto = '';

  categoriaSeleccionada = 'todos';

  /** Búsqueda por nombre o descripción (en el idioma elegido y en español), sin tener en cuenta las tildes. */
  busqueda = '';
  /** Página de la carta (la primera es la 1) y productos por página. */
  pagina = 1;
  tamano = 24;

  readonly alergenos = ALERGENOS;

  /** Texto de los alérgenos de un producto, en el idioma elegido. */
  textoAlergenos(alergenos: readonly string[] | null | undefined): string {
    return textoAlergenos(alergenos, this.idiomas.idioma());
  }

  /** Nombre del producto en el idioma elegido (si el bar lo ha traducido; si no, en español). */
  nombreProducto(producto: Producto): string {
    return nombreDe(producto, this.idiomas.idioma());
  }

  descripcionProducto(producto: Producto): string {
    return descripcionDe(producto, this.idiomas.idioma());
  }

  nombreAlergeno(codigo: string): string {
    return nombreAlergeno(codigo, this.idiomas.idioma());
  }

  /** Estado de la mesa (llega de la API como DISPONIBLE, OCUPADA...) en el idioma elegido. */
  estadoMesa(estado: unknown): string {
    const codigo = String(estado ?? '').toUpperCase();
    return this.idiomas.tSiExiste(`mesa.estado.${codigo}`, String(estado ?? '').toLowerCase());
  }
  alergenosExcluidos = new Set<string>(leerAlergenosExcluidos());
  /**
   * El desplegable empieza abierto si ya había alérgenos elegidos. Solo al entrar: si siguiera al
   * filtro, se cerraría solo al desmarcar el último mientras se usa.
   */
  readonly filtroAlergenosAbiertoAlEntrar = this.alergenosExcluidos.size > 0;

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private readonly authService: AuthService,
    private readonly mesaService: MesaService,
    private readonly productoService: ProductoService,
    private readonly usuarioService: UsuarioService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly sanitizer: DomSanitizer,
    private readonly idiomas: IdiomaService
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();

    this.mesaService.get().subscribe({
      next: data => {
        this.mesas = data || [];
      },
      error: err => console.error('Error cargando mesas:', err)
    });

    this.productoService.get().subscribe({
      next: data => {
        this.productos = data || [];
      },
      error: err => console.error('Error cargando productos:', err)
    });

    this.route.queryParams.subscribe(params => {
      if (params['mesa']) {
        const mesa = Number(params['mesa']);
        if (Number.isInteger(mesa) && mesa > 0) {
          this.idMesa = mesa;
          this.tipoPedido = 'MESA';
          this.mesaBloqueadaPorQr = true;
          this.showToastMessage(this.idiomas.t('carta.toast.qr', { id: mesa }), 'success');
        } else {
          this.showToastMessage(this.idiomas.t('carta.toast.qrInvalido'), 'error');
        }
      }
    });
  }

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  seleccionarTipoPedido(tipo: TipoPedido) {
    this.tipoPedido = tipo;
  }

  /**
   * Carga dirección y teléfono completos para la modalidad A Domicilio
   */
  cargarDatosPerfil() {
    const idGuardado = localStorage.getItem('usuarioId') || localStorage.getItem('id');
    if (!idGuardado) {
      this.showToastMessage(this.idiomas.t('carta.toast.sinSesion'), 'error');
      return;
    }

    this.usuarioService.getId(Number(idGuardado)).subscribe({
      next: (usuario: Usuario) => {
        if (usuario) {
          this.calle = usuario.calle || '';
          this.tipoVivienda = (usuario.tipoVivienda?.toLowerCase() as TipoVivienda) || 'piso';
          this.portalNum = usuario.portalNum || '';
          this.pisoNum = usuario.pisoNum || '';
          this.puerta = usuario.puerta || '';
          this.urbanizacionNombre = usuario.urbanizacionNombre || '';
          this.casaNum = usuario.casaNum || '';
          this.codigoPostal = usuario.codigoPostal || '';
          this.telefonoContacto = usuario.telefono || '';
          
          this.showToastMessage(this.idiomas.t('carta.toast.perfilCargado'), 'success');
        }
      },
      error: (err) => {
        console.error('Error al cargar datos del perfil:', err);
        this.showToastMessage(this.idiomas.t('carta.toast.perfilError'), 'error');
      }
    });
  }

  /**
   * Carga concretamente únicamente el teléfono guardado para la modalidad Para Recoger
   */
  cargarTelefonoPerfil() {
    const idGuardado = localStorage.getItem('usuarioId') || localStorage.getItem('id');
    if (!idGuardado) {
      this.showToastMessage(this.idiomas.t('carta.toast.sinSesion'), 'error');
      return;
    }

    this.usuarioService.getId(Number(idGuardado)).subscribe({
      next: (usuario: Usuario) => {
        if (usuario?.telefono) {
          this.telefonoContacto = usuario.telefono;
          this.showToastMessage(this.idiomas.t('carta.toast.telefonoCargado'), 'success');
        } else {
          this.showToastMessage(this.idiomas.t('carta.toast.sinTelefono'), 'info');
        }
      },
      error: (err) => {
        console.error('Error al cargar teléfono del perfil:', err);
        this.showToastMessage(this.idiomas.t('carta.toast.telefonoError'), 'error');
      }
    });
  }

  get datosServicioCompletos(): boolean {
    if (this.tipoPedido === 'MESA') {
      return this.idMesa !== null;
    }

    if (this.tipoPedido === 'RECOGER') {
      return !!this.telefonoContacto.trim();
    }

    if (this.tipoPedido === 'DOMICILIO') {
      if (!this.calle.trim() || !this.telefonoContacto.trim()) {
        return false;
      }

      if (this.tipoVivienda === 'piso') {
        return !!(this.portalNum.trim() && this.pisoNum.trim() && this.puerta.trim());
      } else if (this.tipoVivienda === 'casa') {
        return !!this.casaNum.trim();
      } else if (this.tipoVivienda === 'urbanizacion') {
        return !!this.casaNum.trim();
      }
    }

    return false;
  }

  getMensajeAdvertencia(): string {
    if (this.tipoPedido === 'MESA') {
      return this.idiomas.t('carta.falta.mesa');
    }
    if (this.tipoPedido === 'RECOGER') {
      return this.idiomas.t('carta.falta.telefono');
    }
    return this.idiomas.t('carta.falta.direccion');
  }

  get detalleViviendaTexto(): string {
    if (this.tipoVivienda === 'piso') {
      const portal = this.portalNum ? `Portal ${this.portalNum}` : '';
      const piso = this.pisoNum ? `${this.pisoNum}º` : '';
      const puerta = this.puerta ? this.puerta.toUpperCase() : '';
      return [portal, piso, puerta].filter(p => p !== '').join(' ');
    } else if (this.tipoVivienda === 'casa') {
      return `Nº ${this.casaNum}`;
    } else if (this.tipoVivienda === 'urbanizacion') {
      const urba = this.urbanizacionNombre.trim() ? `Urb. ${this.urbanizacionNombre.trim()}, ` : '';
      return `${urba}Nº/Chalet ${this.casaNum.trim()}`;
    }
    return '';
  }

  get direccionParaMaps(): string {
    if (this.tipoPedido === 'RECOGER') {
      return `${this.UBICACION_RECOGIDA_FIJA.direccion}, ${this.UBICACION_RECOGIDA_FIJA.cp}`;
    }

    if (!this.calle) return '';
  
    let numero = '';
    if (this.tipoVivienda === 'piso') {
      numero = this.portalNum ? ` ${this.portalNum}` : '';
    } else if (this.tipoVivienda === 'casa' || this.tipoVivienda === 'urbanizacion') {
      numero = this.casaNum ? ` ${this.casaNum}` : '';
    }
  
    const partes = [`${this.calle.trim()}${numero}`, this.codigoPostal].filter(p => p && p.trim() !== '');
    return partes.join(', ');
  }

  get googleMapsUrl(): string {
    const query = encodeURIComponent(this.direccionParaMaps);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  get googleMapsEmbedUrl(): SafeResourceUrl {
    const query = encodeURIComponent(this.direccionParaMaps);
    const baseUrl = 'https://maps.google.com/maps?q=';
    const url = `${baseUrl}${query}&z=18&iwloc=&output=embed`;

    // Seguro: el origen es fijo (maps.google.com) y la direccion va codificada con
    // encodeURIComponent, asi que quien escribe la direccion no puede cambiar el
    // servidor ni el protocolo del iframe. Angular exige este paso para un iframe.
    return this.sanitizer.bypassSecurityTrustResourceUrl(url); // NOSONAR
  }

  filtrarCategoria(cat: string) {
    this.categoriaSeleccionada = cat;
    this.pagina = 1;
  }

  buscar(texto: string): void {
    this.busqueda = texto;
    this.pagina = 1;
  }

  /** Los productos de la página actual, con todos los filtros aplicados. */
  get productosPagina(): Producto[] {
    return paginar(this.productosFiltrados, this.pagina, this.tamano);
  }

  /** Retraso de la animación de cada tarjeta: escalonado, pero sin que las últimas tarden en salir. */
  retrasoTarjeta(indice: number): string {
    return `${Math.min(indice, 12) * 0.04}s`;
  }

  get productosFiltrados(): Producto[] {
    if (!this.productos || this.productos.length === 0) {
      return [];
    }

    const termino = normalizar(this.busqueda);
    const aptos = this.productos.filter(p => aptoSin(p.alergenos, this.alergenosExcluidos)
      && (!termino || [this.nombreProducto(p), p.nombre, this.descripcionProducto(p)]
        .some(texto => normalizar(texto).includes(termino))));
    if (this.categoriaSeleccionada === 'todos') {
      return aptos;
    }

    return aptos.filter(p => {
      const tipoObj = (p as any).tipoProducto || (p as any).tipo || '';
      return String(tipoObj).toLowerCase().trim() === this.categoriaSeleccionada.toLowerCase().trim();
    });
  }

  onAdd(producto: Producto) {
    if (!this.datosServicioCompletos) {
      this.showToastMessage(this.idiomas.t('carta.toast.antesDeAnadir', { falta: this.getMensajeAdvertencia() }), 'error');
      return;
    }

    const item = this.productosSeleccionados.find(i => i.producto.id === producto.id);
    if (item) {
      item.cantidad++;
    } else {
      this.productosSeleccionados.push({ producto, cantidad: 1 });
    }
  }

  onRemove(producto: Producto) {
    const index = this.productosSeleccionados.findIndex(i => i.producto.id === producto.id);
    if (index !== -1) {
      if (this.productosSeleccionados[index].cantidad > 1) {
        this.productosSeleccionados[index].cantidad--;
      } else {
        this.productosSeleccionados.splice(index, 1);
      }
    }
  }

  getCantidad(producto: Producto): number {
    const item = this.productosSeleccionados.find(i => i.producto.id === producto.id);
    return item ? item.cantidad : 0;
  }

  getTotalItems(): number {
    return this.productosSeleccionados.reduce((sum, item) => sum + item.cantidad, 0);
  }

  get direccionCompleta(): string {
    if (this.tipoPedido === 'RECOGER') {
      return `${this.UBICACION_RECOGIDA_FIJA.direccion}, CP ${this.UBICACION_RECOGIDA_FIJA.cp}`;
    }
    const partes = [this.calle, this.detalleViviendaTexto, this.codigoPostal].filter(p => p && p.trim() !== '');
    return partes.join(', ');
  }

  hayProductosSeleccionados(): boolean {
    return this.productosSeleccionados.length > 0;
  }

  calcularTotal(): number {
    return this.productosSeleccionados.reduce((total, item) => total + (item.producto.precio * item.cantidad), 0);
  }

  confirmarPedido() {
    if (!this.datosServicioCompletos) {
      this.showToastMessage(this.idiomas.t('carta.toast.antesDeConfirmar', { falta: this.getMensajeAdvertencia() }), 'error');
      return;
    }

    if (!this.hayProductosSeleccionados()) {
      this.showToastMessage(this.idiomas.t('carta.toast.sinProductos'), 'info');
      return;
    }

    const pedidoPayload = {
      tipoPedido: this.tipoPedido,
      idMesa: this.tipoPedido === 'MESA' ? this.idMesa : null,
      direccionEnvio: this.tipoPedido === 'DOMICILIO' ? this.direccionCompleta : null,
      ubicacionRecogida: this.tipoPedido === 'RECOGER' ? this.direccionCompleta : null,
      telefonoContacto: this.tipoPedido === 'DOMICILIO' || this.tipoPedido === 'RECOGER' ? this.telefonoContacto : null,
      productos: this.productosSeleccionados,
      precioTotal: this.calcularTotal()
    };

    localStorage.setItem('pedidoTemporal', JSON.stringify(pedidoPayload));
    void this.router.navigate(['/confirmar-pedido']);
  }

  imagenNoDisponible(evento: Event): void {
    ponerImagenPorDefecto(evento, IMAGEN_PRODUCTO_POR_DEFECTO);
  }

  getImagenUrl(nombreImagen: string | undefined): string {
    if (!nombreImagen || nombreImagen.trim() === '') {
      return IMAGEN_PRODUCTO_POR_DEFECTO;
    }
    if (nombreImagen.startsWith('assets/')) {
      return encodeURI(nombreImagen);
    }
    return `assets/images/productos/${encodeURI(nombreImagen.trim())}`;
  }

  // ---------- alérgenos ----------

  alternarAlergeno(codigo: string): void {
    const excluidos = new Set(this.alergenosExcluidos);
    if (excluidos.has(codigo)) {
      excluidos.delete(codigo);
    } else {
      excluidos.add(codigo);
    }
    this.alergenosExcluidos = excluidos;
    this.pagina = 1;
    guardarAlergenosExcluidos(excluidos);
  }

  quitarFiltroAlergenos(): void {
    this.alergenosExcluidos = new Set();
    this.pagina = 1;
    guardarAlergenosExcluidos(this.alergenosExcluidos);
  }

  /** «3 productos ocultos, 1 porque aún no tienen la información de alérgenos.» */
  resumenOcultos(): string {
    const { total, sinInformacion } = this.ocultosPorAlergenos;
    let texto = this.idiomas.t(total === 1 ? 'carta.alergenos.oculto' : 'carta.alergenos.ocultos', { n: total });
    if (sinInformacion > 0) {
      texto += this.idiomas.t('carta.alergenos.sinInformacion', { n: sinInformacion });
    }
    return `${texto}.`;
  }

  /** Productos que el filtro de alérgenos esconde y, de ellos, cuántos no tienen la información. */
  get ocultosPorAlergenos(): { total: number; sinInformacion: number } {
    if (this.alergenosExcluidos.size === 0) {
      return { total: 0, sinInformacion: 0 };
    }
    const ocultos = this.productos.filter(p => !aptoSin(p.alergenos, this.alergenosExcluidos));
    return { total: ocultos.length, sinInformacion: ocultos.filter(p => p.alergenos == null).length };
  }
}

/** Minúsculas y sin tildes, para buscar «cafe» y encontrar «Café». */
function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function leerAlergenosExcluidos(): string[] {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE_ALERGENOS) ?? '[]');
    const validos = new Set<string>(ALERGENOS.map(a => a.codigo));
    return Array.isArray(guardados) ? guardados.filter((c: unknown) => typeof c === 'string' && validos.has(c)) : [];
  } catch {
    return [];
  }
}

function guardarAlergenosExcluidos(excluidos: ReadonlySet<string>): void {
  try {
    localStorage.setItem(CLAVE_ALERGENOS, JSON.stringify([...excluidos]));
  } catch {
    // Sin almacenamiento (modo privado): el filtro vale para esta visita
  }
}
