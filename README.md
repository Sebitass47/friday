# FRIDAY

Proyección financiera personal con glassmorphism.

## Stack

**Backend:** FastAPI · PostgreSQL · SQLAlchemy 2.x · Alembic · Celery + Redis · pywebpush
**Frontend:** Next.js 14 · TypeScript · Tailwind CSS · PWA (Service Worker)
**Infra:** Docker Compose · Nginx · Let's Encrypt (producción)

---

## Desarrollo local

### Primera vez

```bash
git clone <repo-url>
cd FRIDAY
docker compose up -d
docker compose exec backend alembic upgrade head
```

- Frontend: http://localhost:3000
- Backend (docs): http://localhost:8000/docs

### Comandos del día a día

```bash
# Levantar
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f celery-worker

# Apagar
docker compose down

# Rebuild después de cambiar dependencias (requirements.txt o package.json)
docker compose build backend
docker compose build frontend
docker compose up -d

# Rebuild completo (todo desde cero)
docker compose build --no-cache
docker compose up -d
```

### Migraciones

```bash
# Aplicar todas las migraciones pendientes
docker compose exec backend alembic upgrade head

# Crear una nueva migración (autogenerar desde los modelos)
docker compose exec backend alembic revision --autogenerate -m "descripcion_corta"

# Ver en qué migración está la DB ahora
docker compose exec backend alembic current

# Rollback una migración
docker compose exec backend alembic downgrade -1

# Rollback a una versión específica (usar el ID de la migración)
docker compose exec backend alembic downgrade 0010
```

---

## Producción (EC2 + dominio propio)

### 0. Requisitos previos en el servidor

```bash
# Instalar Docker + Docker Compose en Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar para que aplique el grupo
```

### 1. Generar llaves VAPID (notificaciones push)

Las llaves VAPID se generan **una sola vez** y se guardan como variables de entorno. Puedes generarlas en cualquier máquina que tenga Python:

```bash
pip install py-vapid
python3 -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('VAPID_PRIVATE_KEY:', v.private_pem().decode())
print('VAPID_PUBLIC_KEY:', v.public_key.public_bytes(
    __import__('cryptography.hazmat.primitives.serialization', fromlist=['Encoding', 'PublicFormat']).Encoding.X962,
    __import__('cryptography.hazmat.primitives.serialization', fromlist=['Encoding', 'PublicFormat']).PublicFormat.UncompressedPoint
).hex())
"
```

O con Node.js (más simple):

```bash
npx web-push generate-vapid-keys
```

Guarda los valores que te devuelva — los usarás en el `.env` del servidor.

### 2. Crear el archivo .env en el servidor

```bash
# En el servidor, dentro del directorio del proyecto
cat > .env <<'EOF'
DB_PASSWORD=cambia_esto_por_una_contraseña_segura
VAPID_PRIVATE_KEY=<pega aquí la private key generada arriba>
VAPID_PUBLIC_KEY=<pega aquí la public key generada arriba>
VAPID_CONTACT_EMAIL=tu@email.com
NEXT_PUBLIC_API_BASE_URL=https://tudominio.com/api/v1
EOF
```

### 3. Configurar el dominio en nginx

Reemplaza el placeholder `TUDOMINIO.COM` en el archivo de configuración de nginx:

```bash
sed -i 's/TUDOMINIO.COM/tudominio.com/g' nginx/nginx.conf nginx/nginx-init.conf
```

### 4. Obtener el certificado SSL (primera vez)

El certificado se obtiene con certbot antes de levantar nginx con HTTPS. Sigue estos pasos en orden:

```bash
# Paso 1: crea el directorio que certbot necesita para el challenge
mkdir -p certbot/www certbot/conf

# Paso 2: levanta solo nginx con la config temporal HTTP (sin HTTPS)
# Reemplaza temporalmente nginx.conf con la versión init
cp nginx/nginx.conf nginx/nginx.conf.bak
cp nginx/nginx-init.conf nginx/nginx.conf

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx

# Paso 3: solicita el certificado
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email tu@email.com \
  --agree-tos \
  --no-eff-email \
  -d tudominio.com \
  -d www.tudominio.com

# Paso 4: restaura la config HTTPS completa
cp nginx/nginx.conf.bak nginx/nginx.conf

# Paso 5: reinicia nginx con la config definitiva
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### 5. Levantar todos los servicios en producción

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 6. Renovación automática del certificado

El servicio `certbot` ya está configurado en `docker-compose.prod.yml` para intentar renovar cada 12 horas. Let's Encrypt solo renueva cuando quedan menos de 30 días, así que es completamente automático.

Si quieres forzar una renovación manual:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### Comandos de producción recurrentes

```bash
# Alias útil para no escribir tanto (puedes añadirlo a ~/.bashrc)
alias dcp='docker compose -f docker-compose.yml -f docker-compose.prod.yml'

# Levantar
dcp up -d

# Ver estado
dcp ps

# Logs
dcp logs -f backend
dcp logs -f nginx

# Rebuild y redeploy después de un git pull
git pull
dcp build backend frontend
dcp up -d --no-deps backend frontend

# Apagar todo
dcp down
```

---

## Estructura del proyecto

```
FRIDAY/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    # Endpoints REST
│   │   ├── models/              # Modelos SQLAlchemy
│   │   ├── schemas/             # Schemas Pydantic
│   │   ├── services/            # Lógica de negocio
│   │   ├── celery_app.py        # Celery + Beat schedule
│   │   ├── tasks.py             # Tareas programadas
│   │   └── core/                # Config, auth, database
│   └── alembic/versions/        # Migraciones (0001–0013)
├── frontend/
│   ├── app/                     # Next.js App Router
│   ├── components/
│   │   ├── layout/              # Sidebar, AppLayout
│   │   ├── ui/                  # Componentes base
│   │   └── charts/              # ProjectionChart, SpendingTimelineChart
│   ├── lib/                     # API client, types, push helpers
│   └── public/                  # Icons, manifest, sw.js
├── nginx/
│   ├── nginx.conf               # Config HTTPS (producción)
│   └── nginx-init.conf          # Config HTTP temporal (solo para obtener el cert)
├── docker-compose.yml           # Local: backend:8000, frontend:3000
└── docker-compose.prod.yml      # Producción: agrega nginx + certbot
```

---

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `DB_PASSWORD` | backend | Contraseña de PostgreSQL |
| `VAPID_PRIVATE_KEY` | backend / celery-worker | Llave privada para push notifications |
| `VAPID_PUBLIC_KEY` | backend | Llave pública para push notifications |
| `VAPID_CONTACT_EMAIL` | backend / celery-worker | Email de contacto VAPID |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | URL del backend (ej: `https://tudominio.com/api/v1`) |

En local no necesitas crear `.env` — los valores por defecto del `docker-compose.yml` son suficientes.
