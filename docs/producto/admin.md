# Guía de uso del administrador

Esta guía describe las funciones exclusivas del rol de administrador. Además de todas las vistas del cliente y del empleado, el administrador dispone del menú **Admin**, con el **Panel de Gestión**, las **Métricas**, el **Registro de jornada** y la **Auditoría**.

## Índice

1. [Acceso al menú de administración](#1-acceso-al-menú-de-administración)
2. [Panel de gestión](#2-panel-de-gestión)
3. [Gestión de productos](#3-gestión-de-productos)
4. [Gestión de pedidos, usuarios, mesas y detalles](#4-gestión-de-pedidos-usuarios-mesas-y-detalles)
5. [Métricas](#5-métricas)
6. [Auditoría](#6-auditoría)

---

## 1. Acceso al menú de administración

El menú **Admin** aparece en la barra de navegación únicamente para los usuarios con rol de administrador. Al desplegarlo se ofrecen dos opciones.

<p align="center">
  <img src="../img/productos/admin1.png" alt="Menú de administración" width="760">
</p>
<p align="center"><em>Menú desplegable Admin con Panel de Gestión y Métricas.</em></p>

| Opción | Función |
| :--- | :--- |
| **Panel de Gestión** | Consulta y mantenimiento de los datos de la base de datos mediante tablas |
| **Métricas** | Estadísticas de negocio por periodo |
| **Registro de jornada** | Entradas, salidas y horas del personal |
| **Auditoría** | Quién hizo qué en la aplicación, cuándo y desde dónde |

> En una instalación nueva con datos de demostración (`APP_SEED_DEMO=true`), el usuario `admin` se crea con la contraseña definida en `APP_SEED_ADMIN_PASSWORD`. Esa contraseña no está en el repositorio.

## 2. Panel de gestión

El **Panel de Administración** es el punto de entrada a la gestión de datos. Muestra cuatro indicadores y cinco accesos a las tablas de gestión.

<p align="center">
  <img src="../img/productos/admin2.png" alt="Panel de administración" width="760">
</p>
<p align="center"><em>Panel de administración.</em></p>

### 2.1. Indicadores

| Indicador | Descripción |
| :--- | :--- |
| **Pedidos totales** | Número de pedidos registrados |
| **Mesas disponibles** | Mesas libres sobre el total |
| **Caja total** | Importe acumulado en caja |
| **Estado del sistema** | Situación operativa de la plataforma |

### 2.2. Tablas de gestión

| Acceso | Contenido |
| :--- | :--- |
| **Detalles de Pedido** | Líneas de cada pedido |
| **Gestionar Mesas** | Disposición y estado de las mesas |
| **Gestionar Pedidos** | Consulta y flujo de todos los pedidos realizados |
| **Gestionar Productos** | Catálogo de la carta |
| **Gestionar Usuarios** | Usuarios registrados, roles y permisos |

## 3. Gestión de productos

La gestión de productos se toma como ejemplo del funcionamiento común de todas las tablas del panel.

### 3.1. Listado

<p align="center">
  <img src="../img/productos/admin3.png" alt="Listado de productos" width="760">
</p>
<p align="center"><em>Listado de productos del catálogo.</em></p>

La tabla muestra nombre, descripción, precio, tipo e imagen de cada producto, junto con el recuento total de registros.

| Elemento | Función |
| :--- | :--- |
| **Buscador** | Filtra por nombre, descripción o tipo |
| **Cabeceras ordenables** | Ordenan la tabla por la columna seleccionada |
| **Nuevo** | Abre el formulario de alta |
| **Volver** | Regresa al panel de administración |

### 3.2. Acciones por registro

| Icono | Acción | Descripción |
| :--- | :--- | :--- |
| Ojo | **Ver** | Muestra el detalle de un único registro |
| Lápiz | **Editar** | Abre el formulario con los datos actuales |
| Papelera | **Eliminar** | Elimina el registro, previa confirmación |

### 3.3. Crear un producto

Se pulsa **Nuevo** y se completa el formulario **Gestión de Producto**:

| Campo | Descripción |
| :--- | :--- |
| Nombre | Denominación del producto |
| Descripción | Texto descriptivo |
| Precio | Importe unitario |
| Tipo | Categoría: bebida, entrante, tapa o postre |
| Alérgenos | Casilla **Información de alérgenos revisada** y, al marcarla, los 14 alérgenos de declaración obligatoria, con su icono, para indicar los que lleva. Sin marcar, la carta dice «Alérgenos: pregunta al personal» y el producto no aparece a quien filtra por alérgenos. Marcada sin ningún alérgeno, la carta dice que no lleva ninguno de declaración obligatoria |
| Imagen | Archivo JPG, PNG o WebP de hasta 5 MB, arrastrándolo al recuadro o seleccionándolo manualmente. El servidor comprueba que realmente es una imagen |

<p align="center">
  <img src="../img/productos/admin4.png" alt="Formulario de alta de producto" width="620">
</p>
<p align="center"><em>Formulario de alta de producto.</em></p>

Los cambios se confirman con **Guardar**. El botón **Volver** descarta la operación.

### 3.4. Ver un producto

La vista de detalle muestra el registro seleccionado y ofrece el botón **Editar Registro**.

<p align="center">
  <img src="../img/productos/admin5.png" alt="Detalle de producto" width="620">
</p>
<p align="center"><em>Detalle de un producto.</em></p>

### 3.5. Editar un producto

El formulario de edición carga los datos existentes y la imagen actual. Se modifican los campos necesarios y se confirma con **Guardar**.

<p align="center">
  <img src="../img/productos/admin6.png" alt="Edición de producto" width="460">
</p>
<p align="center"><em>Formulario de edición con los datos del producto cargados.</em></p>

## 4. Gestión de pedidos, usuarios, mesas y detalles

Las tablas de **pedidos**, **usuarios**, **mesas** y **detalles de pedido** siguen el mismo patrón que la de productos: listado con buscador y ordenación, y las acciones **Ver**, **Editar** y **Eliminar** sobre cada registro, además de la creación de nuevos registros.

| Tabla | Uso principal |
| :--- | :--- |
| **Pedidos** | Consultar y corregir pedidos, estados y pagos |
| **Detalles de pedido** | Revisar o ajustar las líneas de un pedido concreto |
| **Usuarios** | Gestionar cuentas, roles y permisos |
| **Mesas** | Mantener las mesas del establecimiento y su estado |

> Las operaciones de eliminación son definitivas. Se recomienda revisar el registro con la acción **Ver** antes de eliminarlo.

## 5. Métricas

El panel **Métricas y Analítica** presenta el rendimiento del negocio. La información se filtra por periodo y se organiza en cuatro pestañas.

### 5.1. Periodo de análisis

El selector superior derecho permite elegir el intervalo:

| Periodo | Ámbito |
| :--- | :--- |
| **Hoy** | Día en curso |
| **Esta semana** | Semana en curso |
| **Este mes** | Mes en curso |
| **Este año** | Año en curso |
| **Histórico** | Todos los datos registrados |

### 5.2. Indicadores generales

Todas las pestañas comparten cuatro indicadores:

| Indicador | Descripción |
| :--- | :--- |
| **Ingresos totales** | Dinero generado en el periodo |
| **Total pedidos** | Número de pedidos realizados |
| **Ticket promedio** | Importe medio por pedido |
| **Producto estrella** | Producto más vendido |

### 5.3. Finanzas e ingresos

Gráfico de líneas **Dinero generado vs tiempo**, que muestra la evolución de los ingresos en euros a lo largo del periodo seleccionado.

<p align="center">
  <img src="../img/productos/metrica1.png" alt="Métricas de finanzas e ingresos" width="760">
</p>
<p align="center"><em>Evolución de los ingresos.</em></p>

### 5.4. Productos y ventas

Incluye el gráfico de barras **Top productos más vendidos** y el **Ranking de productos vendidos**, con la posición, el producto, la categoría y las unidades vendidas. El ranking puede filtrarse por **Bebidas**, **Tapas**, **Entrantes** o **Postres**.

<p align="center">
  <img src="../img/productos/metricas2.png" alt="Métricas de productos y ventas" width="620">
</p>
<p align="center"><em>Productos más vendidos y ranking.</em></p>

### 5.5. Modalidad de pedidos

Gráfico circular que muestra la distribución de los pedidos entre **A domicilio**, **A recoger** y **En mesa**.

<p align="center">
  <img src="../img/productos/metricas3.png" alt="Métricas de modalidad de pedidos" width="620">
</p>
<p align="center"><em>Distribución de los pedidos por modalidad.</em></p>

La pestaña **Todas las métricas** reúne los tres bloques anteriores en una única vista.

## 6. Auditoría

**Admin → Auditoría** (`/admin/auditoria`) muestra el registro de lo que pasa en la cuenta de cada usuario y en la gestión: sirve para investigar un problema («¿quién cambió los roles de este empleado?», «¿alguien está probando contraseñas?») y para demostrar lo que ocurrió. Las entradas no se pueden modificar ni borrar desde la aplicación y se borran solas al año.

| Columna | Contenido |
| :--- | :--- |
| **Fecha** | Día y hora, con segundos |
| **Usuario** | Quien hizo la acción. En un inicio de sesión fallido, el nombre que se escribió, exista o no la cuenta. En una cuenta eliminada, `eliminado-<número>` |
| **Acción** | Inicio de sesión y su segundo paso, cierre de sesión, confirmación de identidad, registro, cambios de contraseña y de correo, verificación en dos pasos, sesiones cerradas, datos descargados, cuenta eliminada, usuarios creados, editados y borrados, apertura y cierre de caja, y **acceso denegado** (alguien con sesión intentó algo que su rol no permite) |
| **Resultado** | **Correcto**, **Rechazado** (contraseña o código incorrectos, sin permiso, datos no válidos, falta confirmar la identidad), **Bloqueado** (demasiados intentos) o **Error** |
| **IP** | Desde dónde se hizo |
| **Detalle** | Sobre quién se actuó (por ejemplo, `usuario 12 (ana)`), qué cambió (por ejemplo, `roles: CLIENTE -> EMPLEADO`) y la petición (`PUT /usuarios/12`). Nunca contraseñas, códigos ni enlaces |

Por defecto se ven los últimos 7 días. Se puede filtrar por fechas, por usuario (basta con una parte del nombre), por acción y por resultado; hay 50 entradas por página.