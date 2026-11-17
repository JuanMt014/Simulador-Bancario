# AGENTS.md — Proyecto Integrador: Simulador Bancario Web

## 1. Propósito del Sistema y Arquitectura
Desarrollar una aplicación web integral que simule las operaciones básicas de un sistema bancario compuesto por **tres módulos integrados sobre una única base de datos MySQL**, de modo que cualquier operación realizada en uno de ellos se refleje en tiempo real en los demás:
1. **Banca virtual del cliente.**
2. **Módulo administrativo del banco.**
3. **Cajero automático virtual.**

### Stack Tecnológico Obligatorio
- **Backend:** Node.js + Express.js (arquitectura modular: `config/`, `controllers/`, `middlewares/`, `models/`, `routes/`).
- **Base de datos:** MySQL (conexión mediante pool con `mysql2/promise` y variables de entorno con `dotenv`).
- **Frontend:** HTML5, CSS3, JavaScript puro (Fetch API) y Bootstrap 5 (interfaces claras y responsivas).
- **Seguridad:** Contraseñas de acceso y PIN de cajero encriptados con `bcrypt` (nunca en texto plano). Autenticación y control de roles mediante JWT (`jsonwebtoken`).

---

## 2. Reglas de Negocio y Seguridad Estrictas
El agente debe garantizar el cumplimiento de estas reglas tanto en el frontend como en el backend:
1. **Aislamiento de datos:** Un cliente solo puede consultar y operar sobre sus propias cuentas; jamás puede ver información de otro cliente.
2. **Inmutabilidad de campos críticos por el cliente:** El cliente nunca puede modificar directamente su saldo, número de cuenta, rol, estado de la cuenta ni los movimientos financieros.
3. **Validación de montos:** No se permiten consignaciones, retiros ni transferencias con valores menores o iguales a cero (`monto <= 0`).
4. **Control de fondos:** No se puede retirar ni transferir más dinero del saldo disponible en la cuenta origen.
5. **Control de estado de cuenta/usuario:** Los estados válidos son `ACTIVO`, `INACTIVO` y `BLOQUEADO`. Una cuenta o usuario en estado `BLOQUEADO` o `INACTIVO` no puede iniciar sesión ni realizar ninguna operación financiera. No se eliminan clientes físicamente de la base de datos.
6. **Registro inmutable de movimientos:** Toda consignación, retiro y transferencia debe generar automáticamente su registro en la tabla de movimientos con fecha, tipo, descripción, valor y saldo resultante. Los movimientos financieros nunca se eliminan ni editan.
7. **Atomicidad en transferencias:** Toda transferencia entre cuentas registradas debe ejecutarse dentro de una **transacción SQL (`BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`)** que realice exactamente 4 acciones:
   - Verificar existencia y estado `ACTIVO` de cuenta origen y cuenta destino, monto válido y saldo suficiente.
   - Descontar el dinero de la cuenta origen.
   - Incrementar el saldo de la cuenta destino.
   - Registrar el movimiento de débito en la cuenta origen y el movimiento de crédito en la cuenta destino.

---

## 3. Exclusiones del Alcance (NO Implementar)
Para mantener el enfoque en los requisitos obligatorios, **NO implementar**:
- Tarjetas de crédito, préstamos, cálculo de intereses o inversiones.
- Pagos de servicios públicos, PSE o pagos con código QR.
- Transferencias interbancarias hacia bancos externos reales o monedas extranjeras.
- Autenticación biométrica o integración con APIs bancarias reales.

---

## 4. Estructura Requerida de Base de Datos (`database.sql`)
El archivo `database.sql` debe incluir creación de tablas, llaves primarias, llaves foráneas, restricciones (`CHECK`, `UNIQUE`, `NOT NULL`) y datos semilla iniciales:
- **`usuarios`:** `id`, `nombre`, `apellido`, `documento` (único), `correo` (único), `telefono`, `password_hash`, `rol` (`ADMIN` o `CLIENTE`), `estado` (`ACTIVO`, `INACTIVO`, `BLOQUEADO`), `fecha_creacion`.
- **`cuentas`:** `id`, `usuario_id` (FK), `numero_cuenta` (único), `tipo_cuenta` (`AHORROS` o `CORRIENTE`), `saldo` (`DECIMAL(15,2)`), `pin_hash`, `estado` (`ACTIVO`, `INACTIVO`, `BLOQUEADO`), `fecha_creacion`.
- **`movimientos`:** `id`, `cuenta_id` (FK), `tipo_movimiento` (`CONSIGNACION`, `RETIRO`, `TRANSFERENCIA_ENVIADA`, `TRANSFERENCIA_RECIBIDA`), `descripcion`, `valor` (`DECIMAL(15,2)`), `saldo_resultante` (`DECIMAL(15,2)`), `fecha`.
- **`transferencias`:** `id`, `cuenta_origen_id` (FK), `cuenta_destino_id` (FK), `monto` (`DECIMAL(15,2)`), `descripcion`, `fecha`.

### Datos de Prueba Obligatorios (Semilla)
- **1 Administrador** activo.
- **3 Clientes** con cuentas bancarias, distintos saldos iniciales (ej. $1.000.000, $500.000, $250.000) y algunos movimientos iniciales registrados.

---

## 5. Metodología de Trabajo por Fases (Protocolo Obligatorio)
**REGLA DE EJECUCIÓN:** Trabaja estrictamente **una fase a la vez**. Al finalizar cada fase, detente por completo, entrega los comandos o pasos exactos para realizar la prueba manual y **espera la confirmación explícita del usuario** antes de iniciar la siguiente fase. No avances por cuenta propia.

### Fase 1: Configuración base del proyecto y conexión MySQL
- **Alcance:** Crear la estructura de carpetas (`backend/` y `frontend/`), inicializar `backend/package.json` con `express`, `mysql2`, `dotenv`, `cors`, `bcrypt`, `jsonwebtoken`. Crear `.env.example` (sin subir `.env`), configurar la conexión a MySQL y levantar el servidor Express con el endpoint `GET /api/health`.
- **Criterio de prueba manual:** Configurar `.env` local, ejecutar `npm start` en `backend/` y verificar respuesta HTTP `200 OK` en `http://localhost:3000/api/health` junto con conexión exitosa a MySQL.

### Fase 2: Esquema de Base de Datos y Datos Semilla (`database.sql`)
- **Alcance:** Crear `database.sql` en la raíz con las tablas `usuarios`, `cuentas`, `movimientos` y `transferencias`, sus relaciones, llaves foráneas, restricciones y los datos iniciales (1 administrador, 3 clientes con contraseñas y PIN hasheados con `bcrypt`, cuentas con saldos distintos y movimientos iniciales). Documentar credenciales de prueba en `README.md`.
- **Criterio de prueba manual:** Importar `database.sql` en MySQL / phpMyAdmin sin errores y verificar mediante consultas `SELECT` la existencia de las 4 tablas y los 4 usuarios semilla.

### Fase 3: Autenticación, Sesiones y Middlewares de Seguridad
- **Alcance:** Implementar endpoints `POST /api/auth/login` (correo y contraseña para Banca Virtual y Panel Admin) y `POST /api/auth/cajero-login` (número de cuenta y PIN para Cajero Automático). Validar estado `ACTIVO` y crear middlewares de verificación de JWT y autorización por rol (`ADMIN` vs `CLIENTE`).
- **Criterio de prueba manual:** Probar inicio de sesión exitoso con admin, cliente y cajero; verificar rechazo ante credenciales inválidas o usuario `BLOQUEADO`.

### Fase 4: API Backend — Módulo Administrativo del Banco
- **Alcance:** Implementar endpoints protegidos para rol `ADMIN`:
  - `GET /api/admin/dashboard`: métricas (total clientes, cuentas activas, clientes bloqueados, suma total de saldos).
  - CRUD y gestión de clientes: crear cliente (creando también su cuenta bancaria inicial), listar, buscar, ver detalle, editar datos básicos y cambiar estado (`ACTIVO`, `INACTIVO`, `BLOQUEADO`).
  - `GET /api/admin/cuentas` y `GET /api/admin/movimientos`: consulta general de cuentas y movimientos.
  - `POST /api/admin/consignaciones`: consignar dinero a una cuenta activa, incrementar saldo y registrar el movimiento.
- **Criterio de prueba manual:** Ejecutar creación de cliente, bloqueo/activación, consignación y consulta de métricas vía Thunder Client / Postman o curl verificando cambios en MySQL.

### Fase 5: API Backend — Banca Virtual y Cajero Automático
- **Alcance:**
  - **Banca Virtual (`CLIENTE`):** Consultar perfil y cuenta propia, actualizar datos permitidos del perfil, cambiar contraseña, consultar historial de movimientos (fecha, tipo, descripción, valor, saldo resultante) y realizar transferencias atómicas (`POST /api/cliente/transferencias`).
  - **Cajero Automático:** Consultar saldo, realizar retiros (`POST /api/cajero/retiros` validando cuenta activa, monto `> 0` y saldo suficiente) y consultar últimos movimientos.
- **Criterio de prueba manual:** Realizar un retiro desde el endpoint de cajero y una transferencia entre dos clientes verificando actualización de saldos y doble registro de movimientos.

### Fase 6: Frontend Completo y Responsivo (3 Módulos)
- **Alcance:** Construir las interfaces web en `frontend/` (HTML5, CSS3, Bootstrap 5, JS) conectadas al backend:
  - Pantalla de inicio / selector de módulo e inicio de sesión.
  - **Banca Virtual:** Resumen de saldo y cuenta, tabla de movimientos, formulario de transferencias, edición de perfil y cambio de contraseña.
  - **Panel Administrativo:** Tarjetas de métricas del dashboard, gestión de clientes (crear, buscar, editar, bloquear/activar), tabla de cuentas, formulario de consignaciones e historial general.
  - **Cajero Automático:** Interfaz tipo ATM con teclado/formulario de número de cuenta y PIN, consulta de saldo, retiro rápido/personalizado, últimos movimientos y cierre de operación.
- **Criterio de prueba manual:** Navegar por las tres vistas desde el navegador en escritorio y vista móvil verificando mensajes claros de error y confirmación.

### Fase 7: Prueba Integral de Integración y Documentación Final
- **Alcance:** Verificar el flujo completo de integración entre módulos (retiro en cajero -> reflejo inmediato en banca virtual y panel admin -> consignación desde admin -> reflejo en banca virtual) y actualizar `README.md` con instrucciones finales y usuarios de prueba.
- **Criterio de prueba manual:** Ejecutar exitosamente los 9 pasos de la prueba mínima de funcionamiento descrita en el documento de especificación.
