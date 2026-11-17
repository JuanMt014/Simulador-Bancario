-- Esquema y datos iniciales del Simulador Bancario Web.
-- Compatible con MySQL 8.0.16+ y MariaDB con soporte CHECK.

CREATE DATABASE IF NOT EXISTS simulador_bancario
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE simulador_bancario;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  documento VARCHAR(30) NOT NULL,
  correo VARCHAR(160) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  password_hash VARCHAR(60) NOT NULL,
  rol ENUM('ADMIN', 'CLIENTE') NOT NULL DEFAULT 'CLIENTE',
  estado ENUM('ACTIVO', 'INACTIVO', 'BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_usuarios_documento UNIQUE (documento),
  CONSTRAINT uq_usuarios_correo UNIQUE (correo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cuentas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  numero_cuenta VARCHAR(20) NOT NULL,
  tipo_cuenta ENUM('AHORROS', 'CORRIENTE') NOT NULL DEFAULT 'AHORROS',
  saldo DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  pin_hash VARCHAR(60) NOT NULL,
  estado ENUM('ACTIVO', 'INACTIVO', 'BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_cuentas_numero UNIQUE (numero_cuenta),
  CONSTRAINT chk_cuentas_saldo CHECK (saldo >= 0.00),
  CONSTRAINT fk_cuentas_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_cuentas_usuario (usuario_id),
  INDEX idx_cuentas_estado (estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cuenta_id BIGINT UNSIGNED NOT NULL,
  tipo_movimiento ENUM(
    'CONSIGNACION', 'RETIRO', 'TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECIBIDA'
  ) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  saldo_resultante DECIMAL(15,2) NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_movimientos_valor CHECK (valor > 0.00),
  CONSTRAINT chk_movimientos_saldo CHECK (saldo_resultante >= 0.00),
  CONSTRAINT fk_movimientos_cuenta FOREIGN KEY (cuenta_id)
    REFERENCES cuentas (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_movimientos_cuenta_fecha (cuenta_id, fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transferencias (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cuenta_origen_id BIGINT UNSIGNED NOT NULL,
  cuenta_destino_id BIGINT UNSIGNED NOT NULL,
  monto DECIMAL(15,2) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_transferencias_monto CHECK (monto > 0.00),
  CONSTRAINT chk_transferencias_cuentas_distintas CHECK (cuenta_origen_id <> cuenta_destino_id),
  CONSTRAINT fk_transferencias_origen FOREIGN KEY (cuenta_origen_id)
    REFERENCES cuentas (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_transferencias_destino FOREIGN KEY (cuenta_destino_id)
    REFERENCES cuentas (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_transferencias_origen (cuenta_origen_id),
  INDEX idx_transferencias_destino (cuenta_destino_id),
  INDEX idx_transferencias_fecha (fecha)
) ENGINE=InnoDB;

-- Credenciales disponibles en la sección "Usuarios de prueba" del README.
-- Los hashes son bcrypt (coste 10); aquí nunca se almacenan contraseñas ni PIN en claro.
INSERT INTO usuarios
  (id, nombre, apellido, documento, correo, telefono, password_hash, rol, estado)
VALUES
  (1, 'Administrador', 'Banco', '1000000000', 'admin@bancario.com', '3000000000',
   '$2b$10$PjXYWYqxdb4WN3hkguker.WIqSEvkS8.kM1dfFu3a4nyIUjFBj7x2', 'ADMIN', 'ACTIVO'),
  (2, 'Ana', 'Garcia', '1000000001', 'ana.garcia@bancario.com', '3000000001',
   '$2b$10$fIkEobTlyiA4aeqaeKdaC.CHXEf972C/WSAibluitrD/tnVUEhLOS', 'CLIENTE', 'ACTIVO'),
  (3, 'Bruno', 'Martinez', '1000000002', 'bruno.martinez@bancario.com', '3000000002',
   '$2b$10$fIkEobTlyiA4aeqaeKdaC.CHXEf972C/WSAibluitrD/tnVUEhLOS', 'CLIENTE', 'ACTIVO'),
  (4, 'Carla', 'Rodriguez', '1000000003', 'carla.rodriguez@bancario.com', '3000000003',
   '$2b$10$fIkEobTlyiA4aeqaeKdaC.CHXEf972C/WSAibluitrD/tnVUEhLOS', 'CLIENTE', 'ACTIVO');

INSERT INTO cuentas
  (id, usuario_id, numero_cuenta, tipo_cuenta, saldo, pin_hash, estado)
VALUES
  (1, 2, '1000000001', 'AHORROS', 950000.00,
   '$2b$10$pCj6v285suBtmKVE.Uceu.q86SaZijqhE7rr4kvEiN.lHeUFiMXk.', 'ACTIVO'),
  (2, 3, '1000000002', 'AHORROS', 550000.00,
   '$2b$10$O8WLQexQ2MbcIfF9Uf0zn.IGuj0SWKaAQrq/L4doqV79lkBzGml9y', 'ACTIVO'),
  (3, 4, '1000000003', 'CORRIENTE', 250000.00,
   '$2b$10$JgkVIzfLx4on9Jn/2gCTX.WwMvOuQDi/TdwPncf6ZP6SW4IIQlaA2', 'ACTIVO');

INSERT INTO movimientos
  (id, cuenta_id, tipo_movimiento, descripcion, valor, saldo_resultante)
VALUES
  (1, 1, 'CONSIGNACION', 'Consignacion inicial', 1000000.00, 1000000.00),
  (2, 1, 'TRANSFERENCIA_ENVIADA', 'Transferencia inicial a Bruno Martinez', 50000.00, 950000.00),
  (3, 2, 'CONSIGNACION', 'Consignacion inicial', 500000.00, 500000.00),
  (4, 2, 'TRANSFERENCIA_RECIBIDA', 'Transferencia inicial de Ana Garcia', 50000.00, 550000.00),
  (5, 3, 'CONSIGNACION', 'Consignacion inicial', 250000.00, 250000.00);

INSERT INTO transferencias
  (id, cuenta_origen_id, cuenta_destino_id, monto, descripcion)
VALUES
  (1, 1, 2, 50000.00, 'Transferencia inicial de Ana Garcia a Bruno Martinez');
