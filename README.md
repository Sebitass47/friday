# FRIDAY 💰

**Personal Financial Projection App** — Proyección financiera personal con estilo glassmorphism

## ✨ Features

- 📊 **Proyección mensual** — Ve tu dinero disponible los próximos 12 meses
- 💳 **Gestión de gastos** — Registra gastos diarios (efectivo, débito, crédito)
- 💰 **Ingresos puntuales** — Registra ingresos extras del día a día
- 🔄 **Gastos recurrentes** — Netflix, Spotify, renta, etc.
- 🛍️ **MSI tracking** — Seguimiento de compras a meses sin intereses
- 🎯 **Metas de ahorro** — Con fecha estimada de cumplimiento
- 🎲 **Simulador** — Prueba "qué pasaría si..." antes de comprometerte
- 📱 **PWA** — Instálala en tu móvil como app nativa
- 🌙 **Dark mode exclusivo** — Tema oscuro con glassmorphism estilo Apple

## 🎨 Design System

- **Glassmorphism** — Efecto liquid glass con backdrop blur
- **Paleta minimalista**
  - Fondo: `#0A0A0A`
  - Cards: `bg-white/[0.03]` con `backdrop-blur-xl`
  - Bordes: `border-white/10`
  - Texto: `white` / `white/60` / `white/40`
  - Acento positivo: `#A8FF3E`
  - Acento negativo: `#FF4444`
- **Tipografía** — Geist Sans con números tabulares
- **Animaciones** — Transiciones suaves, hover effects, scale on click
- **Responsive** — Mobile-first, optimizado para todas las pantallas

## 🚀 Stack

### Backend
- **FastAPI** — API REST moderna
- **PostgreSQL** — Base de datos relacional
- **SQLAlchemy 2.x** — ORM con modelos tipados
- **Alembic** — Migraciones de base de datos
- **Celery + Redis** — Tareas asíncronas (futuro)

### Frontend
- **Next.js 14** — App Router con Turbopack
- **TypeScript** — Type safety en todo el código
- **Tailwind CSS 4** — Utility-first CSS
- **shadcn/ui** — Componentes con Radix UI
- **next-pwa** — Progressive Web App

### Infraestructura
- **Docker Compose** — Orquestación de servicios
- **Nginx** — Reverse proxy (producción)

## 📦 Instalación

```bash
# Clonar repo
git clone <repo-url>
cd FRIDAY

# Configurar variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Levantar servicios
docker compose up -d

# Aplicar migraciones
docker compose exec backend alembic upgrade head

# Acceder
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
```

## 🏗️ Estructura

```
FRIDAY/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    # Endpoints REST
│   │   ├── models/              # Modelos SQLAlchemy
│   │   ├── schemas/             # Schemas Pydantic
│   │   ├── services/            # Lógica de negocio
│   │   └── core/                # Config, auth, database
│   ├── alembic/                 # Migraciones
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js App Router
│   ├── components/
│   │   ├── layout/              # Sidebar, AppLayout
│   │   ├── ui/                  # shadcn/ui components
│   │   └── charts/              # Gráficas
│   ├── lib/                     # API client, utils, types
│   └── public/                  # Assets, manifest, icons
└── docker-compose.yml
```

## 🎯 Componentes principales

### QuickTransactionFAB
Botón flotante con burbuja glassmorphism para:
- ✅ Registrar gasto (efectivo/débito/crédito)
- ✅ Registrar ingreso puntual

### Sidebar responsive
- Desktop: Fijo a la izquierda con glassmorphism
- Mobile: Menú hamburguesa con backdrop blur

### Cards glassmorphism
```tsx
<Card glass>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>Contenido</CardContent>
</Card>
```

## 🔐 Autenticación

- **JWT** con Bearer token
- Almacenado en `localStorage`
- Auto-redirect a `/login` si token inválido
- Protected routes con `AppLayout`

## 📱 PWA

Instalable en:
- ✅ iOS (Safari → Share → Add to Home Screen)
- ✅ Android (Chrome → Menu → Install app)
- ✅ Desktop (Chrome → Install icon)

Features:
- Offline-ready (service worker)
- App icon con glassmorphism
- Splash screen
- Standalone mode (sin barra del navegador)

## 🎨 Convenciones de código

- **TypeScript estricto** — No `any`
- **Componentes pequeños** — Single responsibility
- **Responsive-first** — Siempre mobile → desktop
- **Glassmorphism** — `bg-white/[0.03] backdrop-blur-xl border-white/10`
- **Animaciones suaves** — `transition-all duration-200`
- **Código en inglés** — Comentarios en español si necesario

## 🐛 Debugging

```bash
# Ver logs backend
docker compose logs -f backend

# Ver logs frontend
docker compose logs -f frontend

# Reiniciar servicios
docker compose restart backend frontend

# Rebuild después de cambios en dependencias
docker compose build backend
docker compose up -d backend
```

## 📝 Migraciones

```bash
# Crear nueva migración
docker compose exec backend alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
docker compose exec backend alembic upgrade head

# Ver estado
docker compose exec backend alembic current

# Rollback
docker compose exec backend alembic downgrade -1
```

## 🚧 Roadmap

- [ ] Página de gastos diarios con filtros
- [ ] Gráfica de gastos por categoría
- [ ] Exportar a CSV/Excel
- [ ] Notificaciones push (PWA)
- [ ] Multi-moneda
- [ ] Compartir proyecciones

## 👨‍💻 Desarrollo

Desarrollado con ☕ por el equipo FRIDAY

---

**Tech stack:** FastAPI · PostgreSQL · Next.js 14 · TypeScript · Tailwind CSS · Docker
