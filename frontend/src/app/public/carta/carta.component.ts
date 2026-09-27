import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../auth/auth.service';
import { MesaService } from '../../admin/pages/mesas/services/mesa';
import { ProductoService } from '../../admin/pages/productos/services/producto';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';
import { Producto } from '../../admin/pages/productos/interface/producto';

export type TipoPedido = 'MESA' | 'DOMICILIO';

interface ProductoSeleccionado {
  producto: Producto;
  cantidad: number;
}

@Component({
  selector: 'app-carta',
  templateUrl: './carta.component.html',
  styleUrls: ['./carta.component.css']
})
export class CartaComponent implements OnInit {
  public isLoggedIn = false;
  mesas: Mesa[] = [];
  productos: Producto[] = [];
  productosSeleccionados: ProductoSeleccionado[] = [];
  
  // Selección de tipo de servicio
  tipoPedido: TipoPedido = 'MESA';
  idMesa: number | null = null;
  mesaBloqueadaPorQr = false;

  // Campos desglosados para Domicilio
  calleNumero = '';
  pisoPuerta = '';
  codigoPostal = '';
  telefonoContacto = '';

  categoriaSeleccionada = 'todos';

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private authService: AuthService,
    private mesaService: MesaService,
    private productoService: ProductoService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();

    this.mesaService.get().subscribe({
      next: data => {
        console.log('Mesas recibidas:', data);
        this.mesas = data || [];
      },
      error: err => console.error('Error cargando mesas:', err)
    });

    this.productoService.get().subscribe({
      next: data => {
        console.log('Productos recibidos:', data);
        this.productos = data || [];
      },
      error: err => console.error('Error cargando productos:', err)
    });

    this.route.queryParams.subscribe(params => {
      if (params['mesa']) {
        this.idMesa = Number(params['mesa']);
        this.tipoPedido = 'MESA';
        this.mesaBloqueadaPorQr = true;
        this.showToastMessage(`Mesa #${this.idMesa} detectada por QR`, 'success');
      }
    });
  }

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  // --- LÓGICA GOOGLE MAPS ---
  get direccionCompleta(): string {
    const partes = [this.calleNumero, this.pisoPuerta, this.codigoPostal].filter(p => p && p.trim() !== '');
    return partes.join(', ');
  }

  get googleMapsUrl(): string {
    if (!this.calleNumero && !this.codigoPostal) {
      return 'https://www.google.com/maps';
    }
    const query = encodeURIComponent(this.direccionCompleta);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  get googleMapsEmbedUrl(): SafeResourceUrl {
    const query = this.direccionCompleta ? encodeURIComponent(this.direccionCompleta) : 'España';
    const url = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // --- FILTRADO DE PRODUCTOS ---
  filtrarCategoria(cat: string) {
    this.categoriaSeleccionada = cat;
  }

  get productosFiltrados(): Producto[] {
    if (!this.productos || this.productos.length === 0) {
      return [];
    }

    if (this.categoriaSeleccionada === 'todos') {
      return this.productos;
    }

    return this.productos.filter(p => {
      // Compara p.tipoProducto o p.tipo aceptando variaciones de nombre de propiedad
      const tipoObj = (p as any).tipoProducto || (p as any).tipo || '';
      return String(tipoObj).toLowerCase().trim() === this.categoriaSeleccionada.toLowerCase().trim();
    });
  }

  // --- CARRITO ---
  onAdd(producto: Producto) {
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

  hayProductosSeleccionados(): boolean {
    return this.productosSeleccionados.length > 0;
  }

  calcularTotal(): number {
    return this.productosSeleccionados.reduce((total, item) => total + (item.producto.precio * item.cantidad), 0);
  }

  confirmarPedido() {
    if (!this.authService.isLoggedIn()) {
      this.showToastMessage('Debe iniciar sesión para realizar un pedido', 'error');
      setTimeout(() => this.router.navigate(['/login']), 1800);
      return;
    }

    if (!this.hayProductosSeleccionados()) {
      this.showToastMessage('Seleccione al menos un producto de la carta', 'info');
      return;
    }

    if (this.tipoPedido === 'MESA' && !this.idMesa) {
      this.showToastMessage('Por favor, selecciona o introduce el número de mesa', 'error');
      return;
    }

    if (this.tipoPedido === 'DOMICILIO') {
      if (!this.calleNumero.trim()) {
        this.showToastMessage('Indica la calle y número de entrega', 'error');
        return;
      }
      if (!this.telefonoContacto.trim()) {
        this.showToastMessage('Proporciona un teléfono de contacto', 'error');
        return;
      }
    }

    const pedidoPayload = {
      tipoPedido: this.tipoPedido,
      idMesa: this.tipoPedido === 'MESA' ? this.idMesa : null,
      direccionEnvio: this.tipoPedido === 'DOMICILIO' ? this.direccionCompleta : null,
      telefonoContacto: this.tipoPedido === 'DOMICILIO' ? this.telefonoContacto : null,
      productos: this.productosSeleccionados,
      precioTotal: this.calcularTotal()
    };

    localStorage.setItem('pedidoTemporal', JSON.stringify(pedidoPayload));
    this.router.navigate(['/confirmar-pedido']);
  }
}