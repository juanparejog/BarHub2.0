-- import.sql

INSERT INTO roles (name) VALUES ('ROLE_ADMIN');
INSERT INTO roles (name) VALUES ('ROLE_CLIENTE');
INSERT INTO roles (name) VALUES ('ROLE_EMPLEADO');

INSERT INTO users (username, password, email) VALUES ('admin', '$2a$10$3uz5MXAJkIX4Gqg4jyYmMOy5jMMUs45yZzMcz2MDo2wy6r7jl/tUS', 'admin@gmail.com');
INSERT INTO users (username, password, email) VALUES ('cliente', '$2a$10$3uz5MXAJkIX4Gqg4jyYmMOy5jMMUs45yZzMcz2MDo2wy6r7jl/tUS', 'cliente@gmail.com');
INSERT INTO users (username, password, email) VALUES ('emple', '$2a$10$3uz5MXAJkIX4Gqg4jyYmMOy5jMMUs45yZzMcz2MDo2wy6r7jl/tUS', 'emple@gmail.com');

INSERT INTO user_roles (user_id, role_id) VALUES (1, 1);
INSERT INTO user_roles (user_id, role_id) VALUES (2, 2);
INSERT INTO user_roles (user_id, role_id) VALUES (3, 3);

INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR001', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR002', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR003', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR004', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR005', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR006', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR007', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR008', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR009', 'DISPONIBLE', NOW(), NOW());
INSERT INTO mesas (codigoQR, estado, created_at, updated_at) VALUES ('QR010', 'DISPONIBLE', NOW(), NOW());

INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Agua Mineral', 'Agua natural del tiempo', 1.0, 'agua_mineral.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Café', 'Café colombiano en grano', 1.2, 'cafe.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Nestea', 'Bebida fria con sabor a té de limón', 1.2, 'nestea.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Coca Cola', 'Bebida fria con sabor a cola', 1.5, 'cocacola.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Zumo de Naranja', 'Zumo de naranja de Valencia', 2.0, 'zumo.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Tercio', 'Tercio de Estrella Galicia', 2.5, 'estrella.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Tercio sin alcohol', 'Tercio de Estrella Galicia sin alcohol', 3.0, 'estrellasin.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Viña Puebla', 'Vino Tinto', 3.5, 'vino_tinto.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Verdejo', 'Vino Blanco', 3.5, 'vino_blanco.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Mojito', 'Cóctel Cubano de ron añejo y zumo de lima acompañado de hierbabuena', 3.5, 'mojito.jpg', 'bebida', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Aceitunas', 'Aceitunas de la estepa extremeña', 2.5, 'aceitunas.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Ensaladilla Rusa', 'Ensaladilla fría de patatas, atún, mayonesa, zanahoria y huevo duro', 3.0, 'ensaladilla.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Pimientos de Padrón', 'Pimientos del padrón unos pican otros no', 3.0, 'pimientos_padron.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Gazpacho', 'Sopa fria de tomate, típica en Andalucía', 3.0, 'gazpacho.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Croquetas', 'Croquetas de jamón ibérico y queso, especialidad de la casa', 3.5, 'croquetas.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Patatas Bravas', 'Patatas fritas con salsa brava y alioli', 3.5, 'patatas_bravas.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Tortilla', 'Tortilla de patatas, especialidad de la casa', 3.5, 'tortilla.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Calamares a la Romana', 'Calamares fritos rebozados en huevo y harina', 4.5, 'calamares.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Queso Manchego', 'Tapita de nuestro mejor queso manchego cortado en rodajas finas', 5.0, 'queso.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Jamón Ibérico', 'Tapita de nuestro mejor jamón pacense cortado en rodajas finas', 6.0, 'jamon_iberico.jpg', 'entrante', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Revuelto de champiñones', 'Revuelto de champiñones, huevo y panceta', 3.5, 'revuelto.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Ensalada Mixta', 'Ensalada fresca con productos de la huerta', 3.5, 'ensalada_mixta.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Albóndigas', 'Albondigas con salsa de tomate y patatas fritas', 4.0, 'albondigas.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Boquerones en Vinagre', 'Boquerones de chipiona en vinagre de módena', 4.0, 'boquerones_vinagre.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Choquitos', 'Choquitos de chipirona fritos', 4.0, 'chocos.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Chorizo a la Sidra', 'Tapa de chorizo cocido en sidra de manzana', 4.5, 'chorizo_sidra.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Serranito', 'Bocata de lomo, jamón, pimiento verde y queso', 4.5, 'serranito.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Gambas al Ajillo', 'Gambas con salsa al ajillo', 5.5, 'gambas_ajillo.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Pimientos Rellenos', 'Pimientos rojos rellenos de rulo de cabra', 5.0, 'pimientos_rellenos.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Pulpo a la Gallega', 'Pulpo cortado en rodajas, con una base de patatas cocidas y especiado con pimentón de la vera y un chorrito de aceite', 6.0, 'pulpo_gallega.jpg', 'tapa', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Pastel de belén', 'Postre portugués con crema', 2.5, 'pdebelen.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Helado', 'Bola de helado', 2.5, 'helado.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Natillas', 'Natillas sabor vainilla', 2.8, 'natillas.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Serradura', 'Postre portugués compuesto por capas de galleta y nata', 2.8, 'serradura.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Flan', 'Flan de huevo', 2.5, 'flan.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Torrija', 'Torrijas de la abuela', 3.2, 'torrija.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Brownie', 'Brownie de chocolate', 3.0, 'brownie.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Coulan', 'Coulan de chocolate', 3.0, 'coulan.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Mousse', 'Mousse de Chocolate', 3.5, 'mousse.jpg', 'postre', NOW(), NOW());
INSERT INTO productos (nombre, descripcion, precio, imagen, tipo_producto, created_at, updated_at) VALUES ('Tarta de Queso', 'Tarta de queso', 3.5, 'tarta_queso.jpg', 'postre', NOW(), NOW());
