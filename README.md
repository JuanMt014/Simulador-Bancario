# Simulador Bancario Web

## Descripción
Aplicación web que simula las operaciones básicas de un sistema bancario integrado por tres módulos trabajando sobre la misma base de datos MySQL:
- **Banca virtual del cliente:** Consulta de saldo, historial de movimientos, transferencias entre cuentas, gestión de perfil y cambio de contraseña.
- **Módulo administrativo del banco:** Dashboard con métricas generales, gestión y bloqueo de clientes, consulta de cuentas, consignaciones e historial general.
- **Cajero automático virtual:** Autenticación mediante número de cuenta y PIN, consulta de saldo, retiros y últimos movimientos.

## Integrantes
- Juan Montes
- Santiago Nieto

## Tecnologías Utilizadas
- **Backend:** Node.js, Express.js
- **Base de datos:** MySQL
- **Frontend:** HTML5, CSS3, JavaScript, Bootstrap

## Requisitos para ejecutar el proyecto
- Node.js (v18 o superior)
- MySQL / MariaDB (XAMPP o servidor local)
- Git

## Instrucciones de instalación
1. Clonar el repositorio:
   ```bash
   git clone [https://github.com/JuanMt014/Simulador-Bancario.git](https://github.com/JuanMt014/Simulador-Bancario.git)  
   ```

## Usuarios de prueba

Importa primero `database.sql` en MySQL. Las siguientes credenciales corresponden a los datos semilla; las contraseñas y PIN se guardan en la base de datos como hashes bcrypt.

| Rol | Correo | Contraseña | Número de cuenta | PIN de cajero |
|---|---|---|---|---|
| Administrador | `admin@bancario.com` | `Admin123!` | No aplica | No aplica |
| Cliente | `ana.garcia@bancario.com` | `Cliente123!` | `1000000001` | `1234` |
| Cliente | `bruno.martinez@bancario.com` | `Cliente123!` | `1000000002` | `2345` |
| Cliente | `carla.rodriguez@bancario.com` | `Cliente123!` | `1000000003` | `3456` |

Los saldos finales semilla son $950.000,00 para Ana, $550.000,00 para Bruno y $250.000,00 para Carla. El saldo de Ana y Bruno ya refleja una transferencia inicial de $50.000,00 entre sus cuentas.
