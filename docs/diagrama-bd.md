# Diagrama entidad-relación

El modelo utiliza claves foráneas restrictivas para conservar clientes, cuentas y movimientos financieros. Una cuenta pertenece a un usuario; cada movimiento pertenece a una cuenta; cada transferencia relaciona una cuenta origen y una cuenta destino.

```mermaid
erDiagram
    USUARIOS ||--o{ CUENTAS : posee
    CUENTAS ||--o{ MOVIMIENTOS : registra
    CUENTAS ||--o{ TRANSFERENCIAS : origina
    CUENTAS ||--o{ TRANSFERENCIAS : recibe

    USUARIOS {
        BIGINT id PK
        VARCHAR nombre
        VARCHAR apellido
        VARCHAR documento UK
        VARCHAR correo UK
        VARCHAR telefono
        VARCHAR password_hash
        ENUM rol
        ENUM estado
        TIMESTAMP fecha_creacion
    }
    CUENTAS {
        BIGINT id PK
        BIGINT usuario_id FK
        VARCHAR numero_cuenta UK
        ENUM tipo_cuenta
        DECIMAL saldo
        VARCHAR pin_hash
        ENUM estado
        TIMESTAMP fecha_creacion
    }
    MOVIMIENTOS {
        BIGINT id PK
        BIGINT cuenta_id FK
        ENUM tipo_movimiento
        VARCHAR descripcion
        DECIMAL valor
        DECIMAL saldo_resultante
        TIMESTAMP fecha
    }
    TRANSFERENCIAS {
        BIGINT id PK
        BIGINT cuenta_origen_id FK
        BIGINT cuenta_destino_id FK
        DECIMAL monto
        VARCHAR descripcion
        TIMESTAMP fecha
    }
```

El esquema ejecutable y sus restricciones están en [`../database.sql`](../database.sql).
