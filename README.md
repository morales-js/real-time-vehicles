# 🚗 AutoPuja GT — Subastas de vehículos en tiempo real

Plataforma web (caso Copart) para publicar vehículos de subasta y **pujar en tiempo real**: la oferta actual, el temporizador y los indicadores de estado se actualizan en todos los navegadores conectados **sin recargar la página**.

## 🌐 Sitio publicado

### 👉 **https://TU-APP.azurewebsites.net** 👈

> Reemplaza este enlace por la URL real de Azure después de desplegar.

---

## 🔑 Credenciales de prueba

Para probar la subasta cruzada, abre **dos o tres navegadores distintos** (o uno normal y otro en modo incógnito), inicia sesión con usuarios diferentes y entra al mismo vehículo.

| # | Usuario | Correo | Contraseña |
|---|---------|--------|------------|
| 1 | Ana García | `ana@autopuja.gt` | `Ana#2026!` |
| 2 | Carlos López | `carlos@autopuja.gt` | `Carlos#2026!` |
| 3 | Sofía Martínez | `sofia@autopuja.gt` | `Sofia#2026!` |
| 4 | Importadora Demo (vendedor de la mayoría de vehículos demo) | `demo@autopuja.gt` | `Demo#2026!` |

**Prueba sugerida:** Ana y Carlos abren el *Jeep Wrangler Sport 2017*. Carlos va ganando (badge verde) y Ana ve el badge rojo *"Tu oferta ha sido superada"*. Ana oferta el mínimo y, al instante y sin F5, la pantalla de Carlos muestra el nuevo monto, su badge cambia a rojo y le llega una notificación.

Para probar el cierre automático, publica un vehículo con cierre en unos 2–3 minutos y mira cómo pasa a **Vendida** o a **Desierta** en vivo.

---

## ✅ Requerimientos cubiertos

| Requerimiento | Implementación |
|---|---|
| **Login obligatorio** | Sin sesión, el Home, el inventario y el detalle se ven **en modo lectura**. Para ofertar o publicar se exige sesión, tanto en el frontend (rutas protegidas) como en la API (JWT, `401`). |
| **Registro** | Nombre, apellido, correo, teléfono y **contraseña segura** (8+ caracteres, mayúscula, minúscula, número y símbolo), validada en el cliente y en el servidor. Se guarda con hash bcrypt. |
| **Publicación** | Ficha técnica completa (año, tipo, marca, modelo, motor, transmisión, combustible, tren de manejo AWD/FWD/RWD/4WD, cilindros), estado de daño 🟢🟡🔴, **mínimo 5 fotos**, monto base, fecha y hora de inicio y de cierre. |
| **Editar mis publicaciones** | *Mis publicaciones* permite buscar (texto y estado) y editar. Si la subasta ya tiene ofertas, el monto base y el inicio quedan bloqueados y el cierre solo puede extenderse. |
| **Inventario con filtros multitarea** | Filtros combinables por texto, marca, modelo, motor, año (desde/hasta), tipo, combustible, transmisión, tren de manejo, cilindros, nivel de daño, precio y estado, más ordenamiento y paginación. Los filtros se guardan en la URL. |
| **Detalle** | Ficha técnica completa y **carrusel interactivo** (flechas, miniaturas, teclado, deslizamiento táctil y pantalla completa). |
| **Regla de puja** | La oferta debe ser ≥ monto base y > oferta actual, y superar la actual en **al menos 10 %**. Se valida en el servidor dentro de una transacción con `UPDLOCK`, así que dos pujas simultáneas nunca ganan ambas. |
| **Privacidad** | La API **nunca** devuelve la identidad de los postores. El historial muestra "Postor anónimo" y solo marca como "Tu oferta" las del propio usuario. |
| **Oferta cerrada** | Al terminar el tiempo el formulario se deshabilita y se muestra *"Oferta cerrada"*. El servidor también rechaza cualquier puja tardía. |
| **Tiempo real (crítico)** | Socket.IO (WebSockets). La oferta actual, el historial, el contador de espectadores y el reloj se actualizan en todos los clientes. El reloj se **sincroniza con la hora del servidor**. |
| **Indicador visual** | Badge verde *"¡Vas ganando esta subasta!"* o badge rojo *"Tu oferta ha sido superada. ¡Haz tu oferta ahora antes de que termine el tiempo!"*. Además llegan notificaciones (toasts) en cualquier página. |
| **Cierre de subasta** | Un proceso del servidor revisa cada segundo las subastas vencidas. Con ofertas ≥ base la subasta queda **VENDIDA**; sin ellas, **DESIERTA / no vendida**. El resultado se notifica en vivo. |

---

## 🏗️ Arquitectura

```
┌───────────────────────┐   HTTPS (REST/JSON)    ┌───────────────────────────┐       ┌──────────────────┐
│  Frontend SPA         │ ─────────────────────▶ │  Web API (Node + Express) │ ────▶ │  SQL Server /    │
│  React 19 + Vite      │                        │  JWT · bcrypt · multer    │       │  Azure SQL       │
│  React Router         │ ◀═════ WebSocket ════▶ │  Socket.IO (tiempo real)  │       └──────────────────┘
└───────────────────────┘      (Socket.IO)       │  Job de cierre de subastas│
                                                 └───────────────────────────┘
```

- **`frontend/`**: SPA en React con consumo asíncrono de la API (`fetch`) y estado dinámico (Context + hooks). En producción se compila a `backend/public`.
- **`backend/`**: Web API RESTful con Express, driver `mssql` para SQL Server y Socket.IO. Al arrancar crea el esquema y los catálogos, y siembra los datos demo si la base está vacía.

### Endpoints principales

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | — | Registro |
| POST | `/api/auth/login` | — | Login (devuelve un JWT) |
| GET | `/api/auth/me` | ✔ | Usuario actual |
| GET | `/api/catalogs` · `/api/catalogs/:nombre` | — | Catálogos: marcas, tipos, combustibles, transmisiones, trenes de manejo y niveles de daño |
| GET | `/api/vehicles?q=&brandId=&yearMin=&damageLevelId=1,3&status=&sort=&page=` | — | Inventario con filtros |
| GET | `/api/vehicles/:id` | — | Detalle + fotos + estado de la subasta |
| GET | `/api/vehicles/:id/bids` | — | Historial anónimo |
| POST | `/api/vehicles` | ✔ | Publicar (multipart, 5 a 12 fotos) |
| PUT | `/api/vehicles/:id` | ✔ (dueño) | Editar publicación |
| POST | `/api/vehicles/:id/bids` | ✔ | Ofertar |
| GET | `/api/me/vehicles` · `/api/me/bids` | ✔ | Mis publicaciones / mis pujas |
| GET | `/api/images/:id` | — | Fotografía |
| GET | `/api/stats` · `/api/health` | — | Indicadores / estado |

**Eventos Socket.IO:** `auction:join`, `auction:leave`, `auction:bid`, `auction:closed`, `auction:viewers`, `auction:refresh`, `inventory:bid`, `inventory:closed`, `inventory:changed`, `notification`, `clock:sync`.

### Modelo de datos

`Users`, `Vehicles`, `VehicleImages` (fotos en `VARBINARY`), `Bids` y los catálogos `Brands`, `ItemTypes`, `FuelTypes`, `Transmissions`, `DriveTrains` y `DamageLevels`. El script está en [backend/src/db/schema.sql](backend/src/db/schema.sql).

---

## 💻 Ejecutar en local

Requisitos: Node.js 20+ y SQL Server con autenticación SQL y TCP 1433 habilitados.

```bash
# 1. Base de datos y usuario (una sola vez)
sqlcmd -S localhost -E -Q "CREATE DATABASE SubastasDB; CREATE LOGIN subastas_app WITH PASSWORD='Subastas#2026!', CHECK_POLICY=OFF;"
sqlcmd -S localhost -E -d SubastasDB -Q "CREATE USER subastas_app FOR LOGIN subastas_app; ALTER ROLE db_owner ADD MEMBER subastas_app;"

# 2. Configuración
cp backend/.env.example backend/.env    # y edita las credenciales (pon entre comillas las claves que tengan #)

# 3. Instalar, compilar y ejecutar
npm install
npm run build
npm start                               # http://localhost:4000
```

Modo desarrollo con recarga en caliente: ejecuta `npm run dev:api` y `npm run dev:web` en dos terminales y abre http://localhost:5173.

Para reiniciar los datos demo (fechas nuevas): `npm run seed:reset`.

---

## ☁️ Despliegue

Publicado en **Azure App Service** (Linux, Node 22) con **Azure SQL Database**, con despliegue continuo desde GitHub Actions.

# real-time-vehicles
Plataforma Web de Subastas de Vehículos en Tiempo Real - Parcial II
