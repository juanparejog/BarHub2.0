import { Pipe, PipeTransform, inject } from '@angular/core';
import { IdiomaService } from './idioma.service';
import type { Clave, Parametros } from './textos';

/**
 * {@code {{ 'carta.titulo' | t }}} o, con datos, {@code {{ 'carta.mesa.opcion' | t: { id: 3 } }}}.
 * No es pura para que cambie al momento cuando se elige otro idioma (lee la señal del idioma).
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TraducirPipe implements PipeTransform {
  private readonly idiomas = inject(IdiomaService);

  transform(clave: Clave, parametros?: Parametros): string {
    return this.idiomas.t(clave, parametros);
  }
}

/** {@code {{ producto.precio | precio }}}: euros con el formato del idioma elegido. */
@Pipe({ name: 'precio', standalone: true, pure: false })
export class PrecioPipe implements PipeTransform {
  private readonly idiomas = inject(IdiomaService);

  transform(valor: number | string | null | undefined): string {
    return this.idiomas.precio(valor);
  }
}
