import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { MesaService } from '../../admin/pages/mesas/services/mesa';
import { ProductoService } from '../../admin/pages/productos/services/producto';
import { Mesa } from '../../admin/pages/mesas/interface/mesa';
import { Producto } from '../../admin/pages/productos/interface/producto';

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
  idMesa: number | null = null;
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  constructor(
    private authService: AuthService,
    private mesaService: MesaService,
    private productoService: ProductoService,
    private router: Router
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.mesaService.get().subscribe(data => this.mesas = data);
    this.productoService.get().subscribe(data => this.productos = data);
  }

  // Lógica botón +
  onAdd(producto: Producto) {
    // Buscar si el producto ya está en la lista de seleccionados
    const productoExistente = this.productosSeleccionados.find(
      item => item.producto.id === producto.id
    );

    if (productoExistente) {
      // Si ya existe, incrementar la cantidad
      productoExistente.cantidad++;
    } else {
      // Si no existe, agregarlo con cantidad 1
      this.productosSeleccionados.push({
        producto: producto,
        cantidad: 1
      });
    }
  }

  // Disminuir cantidad
  onRemove(producto: Producto) {
    const index = this.productosSeleccionados.findIndex(
      item => item.producto.id === producto.id
    );
    
    if (index !== -1) {
      if (this.productosSeleccionados[index].cantidad > 1) {
        // Si hay más de 1, reducir la cantidad
        this.productosSeleccionados[index].cantidad--;
      } else {
        // Si solo hay 1, eliminar el producto de seleccionados
        this.productosSeleccionados.splice(index, 1);
      }
    }
  }

  // Obtener la cantidad de un producto
  getCantidad(producto: Producto): number {
    const productoSeleccionado = this.productosSeleccionados.find(
      item => item.producto.id === producto.id
    );
    return productoSeleccionado ? productoSeleccionado.cantidad : 0;
  }

  // Verificar si hay productos seleccionados
  hayProductosSeleccionados(): boolean {
    return this.productosSeleccionados.length > 0;
  }

  // Calcular el total del pedido
  calcularTotal(): number {
    return this.productosSeleccionados.reduce(
      (total, item) => total + (item.producto.precio * item.cantidad), 
      0
    );
  }

  // Confirmar pedido
  confirmarPedido() {
    // Confirmar que el usuario haya iniciado sesion
    if (!this.authService.isLoggedIn()) {
      this.showToastMessage('Debe iniciar sesión para continuar');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
      return;
    }

    // Validar que se haya seleccionado al menos un producto
    if (!this.hayProductosSeleccionados()) {
      this.showToastMessage('Debe seleccionar al menos un producto');
      return;
    }

    // Validar que se haya ingresado el ID de mesa
    if (!this.idMesa) {
      this.showToastMessage('Debe ingresar el número de mesa');
      return;
    }

    // Guardar el pedido en el localStorage para usarlo en la siguiente página
    localStorage.setItem('pedidoTemporal', JSON.stringify({
      idMesa: this.idMesa,
      productos: this.productosSeleccionados
    }));

    // Redireccionar a la página de confirmación
    this.router.navigate(['/confirmar-pedido']);
  }

  get productosPorSeccion(): { [seccion: string]: Producto[] } {
    const secciones = ['bebida', 'entrante', 'tapa', 'postre'] as const;
    const agrupados: { [key: string]: Producto[] } = {};
  
    secciones.forEach(seccion => {
      agrupados[seccion] = this.productos.filter(p => p.tipoProducto === seccion);
    });
  
    return agrupados;
  }
  
  obtenerNombreSeccion(seccion: string): string {
    const nombres: { [key: string]: string } = {
      'bebida': 'Bebidas',
      'entrante': 'Entrantes',
      'tapa': 'Tapas Principales',
      'postre': 'Postres'
    };
    return nombres[seccion] || seccion;
  }  
}