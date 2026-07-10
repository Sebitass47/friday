# FRIDAY — Contexto para agentes

> **Instrucción para el agente:** Al terminar cualquier tarea:
> 1. **Actualiza este archivo** — si agregaste módulo, endpoint, modelo, página o componente, añádelo en la sección correspondiente. Si completaste algo de "Lo que viene", muévelo a donde corresponda.
> 2. **Haz un commit** con un mensaje descriptivo de lo que se hizo (en inglés, estilo convencional: `feat:`, `fix:`, `docs:`, etc.). Siempre incluye `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
> 3. **Reconstruye y reinicia los contenedores afectados** si están corriendo: `docker compose build <servicio> && docker compose up -d --no-deps <servicio>`. Si cambiaron backend y frontend, reconstruye ambos.



FRIDAY es una app personal de Sebastian. Empezó como tracker de finanzas personales, pero la visión es que sea su app personal completa: finanzas, to-dos, notas, ambiente lofi, etc. Cada módulo nuevo vive en una ruta nueva del mismo frontend Next.js y puede tener sus propios endpoints en el backend FastAPI. Todo corre en Docker Compose.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 App Router · TypeScript estricto · Tailwind CSS · PWA |
| Backend | FastAPI · SQLAlchemy 2.x · Alembic · PostgreSQL |
| Cola | Celery + Celery Beat · Redis |
| Push | pywebpush (VAPID) — sin servicios externos |
| Infra local | `docker compose up -d` — backend:8000, frontend:3000 |
| Infra prod | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` + nginx + Let's Encrypt |

---

## Módulos ya construidos

### Inicio (`/`)

Dashboard personal central. Reemplaza el redirect que había a `/dashboard`.

**Cards:**
- **Finanzas del mes** — disponible (ingreso − compromisos − gastado cash/débito), 3 sub-métricas, chips de pagos de tarjeta próximos (≤7 días)
- **Recordatorios de hoy** — tareas con `due_date = hoy` que no están completadas
- **Próximos 7 días** — eventos ordenados por fecha con badge relativo (Hoy / Mañana / Mié…)
- **Notas recientes** — notas creadas hace menos de 7 días, mini-cards con color de fondo

**FAB speed-dial** (bottom-right, siempre visible):
- Botón + con gradiente rosa-morado; al abrir rota a X y expande 4 opciones animadas
- 💸 Gasto → `/dashboard?new=1` (abre QuickTransactionFAB automáticamente)
- ✅ Tarea → `/to_do?new=1` (abre panel de crear tarea)
- 📅 Evento → `/events?new=1` (abre panel de crear evento)
- 📝 Nota → `/notas?new=1` (abre formulario de nueva nota)

**Auto-open `?new=1`:** implementado en QuickTransactionFAB, to_do, events y notas — al llegar con ese param el formulario se abre solo.

### Finanzas (`/dashboard`)

Todo vive en `frontend/app/dashboard/page.tsx` (un archivo grande, ~1200 líneas). Los datos se cargan en `loadAll()` al montar.

**KPIs del header:**
- Disponible este mes (ingreso − compromisos − gastos cash/débito del mes)
- Ingreso mensual (editable con lápiz — modal `edit-income`)
- Total compromisos

**Secciones:**
- Spending Timeline Chart — SVG paso a paso de gastos del mes, navegable por períodos, `cycleStartDay` guardado en localStorage (`friday_cycle_start_day`)
- Tarjetas de crédito — badge de uso con color dinámico (≤33% morado, 33–66% ámbar, >66% rojo), botón "Pagar este mes" que abre modal con monto y nuevo saldo
- MSI (Meses Sin Intereses) — CRUD completo, botón "Liquidar"
- Metas de ahorro — CRUD completo, botón "Ahorré este mes" (modal con monto editable)
- Gastos recurrentes — CRUD completo
- Cuentas — CRUD completo (débito, ahorro, crédito)
- Proyección 12 meses — `ProjectionChart.tsx`, gráfica de barras SVG pura (al fondo de la página)
- Simulador MSI — integrado al fondo, después de la proyección (ya no es página separada)

**Registrar transacción** (botón "Registrar" en header + FAB flotante `QuickTransactionFAB.tsx`):
- Gasto: efectivo / débito / crédito, categoría opcional
- Ingreso puntual: descripción, monto, categoría
- Toggle "¿Es tu ingreso mensual fijo?" → guarda en `monthly_income` con `income_start_day`

### Simulador (sección dentro de `/dashboard`)

Ya no es una página separada. Vive al final de la página de Finanzas, debajo de la Proyección 12 meses. Simula el impacto de una compra a MSI en los próximos 12 meses. Llama a `POST /projection/simulate/`.

### Tareas (`/to_do`)

Lista de recordatorios/tareas personales. Diseño minimalista dark con panel lateral derecho para crear/editar.

**Funcionalidades:**
- Crear tareas con título, etiqueta, fecha, hora de recordatorio, opción "avisar 1 día antes", repetición y notas
- Subtareas con progreso (2/3)
- Marcar como completada (toggle), estrella (favorita)
- Filtros por etiqueta, búsqueda de texto, ordenar por fecha/nombre/estrella
- Lista agrupada por: Hoy, Mañana, Esta semana, Sin fecha
- Push notifications via Celery Beat cada 5 minutos

### Espacio Focus (`/focus`)

Página full-screen de productividad tipo "focus space". Sin sidebar, layout propio con auth check inline.

**Fondos animados (canvas 2D):**
- Lluvia: gotas animadas con ángulo, glow morado en el suelo
- Brasas: partículas de brasa flotando hacia arriba con glow
- Aurora: 10 blobs de colores vivos moviéndose rápido (sin efecto cristal)
- Cosmos: campo de estrellas 3D con proyección de perspectiva (warp-speed), nebulosas y trails
- Mar: océano nocturno Three.js con PlaneGeometry y animación de vértices (olas), luna PointLight y estrellas Points
- Planeta: Three.js SphereGeometry con CanvasTexture de bandas, anillos RingGeometry inclinados, atmósfera transparente y DirectionalLight
- Túnel: Three.js corredor hexagonal — rings de MeshBasicMaterial vuelan hacia la cámara con niebla Fog

**Sonidos ambientales (mp3 reales en `/public/sounds/`):**
- 6 sonidos: Lluvia, Olas, Viento, Cascada, Aves, Fuego
- Mezcla de volúmenes independiente, mezclador en barra inferior fija

**Lofi Boy player:**
- Player flotante (bottom-left) con embed de YouTube — Lofi Boy 24/7 stream
- Activable con botón "Música" en el header; se cierra con ×
- Se eleva sobre la barra de sonidos cuando ambos están visibles

**Pomodoro:**
- 3 estilos de reloj: Anillo (SVG con arc de progreso), Minimal (texto grande + barra), Tarjeta (card oscura con ±)
- Fases: Concentración / Descanso Corto / Descanso Largo
- Ajustes: duración de sesión, descansos, sesiones por ciclo, objetivo de horas
- Campanita al cambiar de fase (Web Audio)

**Panel de tareas:**
- Tareas del día (due_date = hoy, sin recurrencia, sin eventos)
- TaskCard: circle toggle + título + badge etiqueta + estrella; click abre TaskDetail modal
- TaskDetail: título, toggle completar, estrella, notas, fecha/hora, recordatorio, subtareas
- Input para agregar tarea rápida con etiqueta
- Panel flotante ocultable

**UI:**
- Modo zen (oculta header y controles, solo fondo + timer)
- Botones Tareas / Sonidos / Música / Zen en header
- Sidebar: prop `hideExternalToggle` — Focus maneja su propio ☰ en el header
- Color acento: #6B46E5 (morado FRIDAY)
- Sin modo claro/oscuro — siempre dark full-screen

### Notas (`/notas`)

Página de notas rápidas con colores y etiquetas. Diseño grid 2 columnas, soporte dark/light mode.

**Funcionalidades:**
- Crear notas con título, contenido, etiqueta, color de fondo y opción de fijar
- 6 colores de fondo: rojo, verde, amarillo, morado, azul, rosa (+ default neutro)
- 5 etiquetas: Trabajo, Personal, Hogar, Finanzas, Ideas
- Sección "Fijadas" (pin activo, badge rosa) y "Otras"
- Filtro por etiqueta y búsqueda por texto (cliente)
- Editar nota: clic en la card abre el formulario con los datos actuales
- Eliminar: ícono 🗑 con doble-clic (primero click pone rojo 2.5s, segundo confirma)
- Toggle pin: ícono 📌 top-right de cada card
- FAB + (gradiente rosa-morado) bottom-right para nueva nota
- Light mode: fondos claros pastel por color, texto oscuro

**Archivos:**
- `frontend/app/notas/page.tsx` — página completa (NoteCard + NoteForm inline)

### Hábitos (`/habitos`)

Tracker semanal de hábitos. Tabla tipo grid donde cada fila es un hábito y cada columna es un día de la semana. Navegar entre semanas con flechas.

**Funcionalidades:**
- Vista semanal (Lun–Dom) con flechas de navegación entre semanas
- Toggle de completado por día — checkbox redondeado con el color propio del hábito cuando está marcado
- Cada hábito tiene un color único asignado aleatoriamente al crearse (paleta de 10 colores vivos)
- Columna `%` con el porcentaje de días completados en la semana actual (color del hábito cuando > 0)
- Eliminar hábito: clic → rojo 2.5s → segundo clic confirma
- Input inferior + botón "Agregar" para crear hábito nuevo
- Cards de resumen debajo de la tabla: total hábitos, completados hoy, promedio semanal, racha máxima
- Día actual destacado en morado en el header de columnas
- Soporte dark/light mode, responsive con scroll horizontal en tabla en móvil
- Push notifications motivacionales a las 15:00, 18:00 y 21:00 (hora México) indicando cuántos hábitos faltan para ese día

**Archivos:**
- `frontend/app/habitos/page.tsx` — página completa

### Eventos (`/events`)

Lista de eventos tipo calendario. Mismo diseño que `/to_do` pero para cosas con fecha fija (citas, reuniones, etc.). **No tiene endpoint propio en el backend** — reutiliza la API de tareas (`/tasks/`) filtrando por `is_event=true`.

**Funcionalidades:**
- Crear eventos con título, etiqueta, fecha, hora, "Todo el día", ubicación y notas
- Lista agrupada por: Pasados, Hoy, Mañana, Próximamente, Sin fecha
- Push notifications automáticas 3 días, 1 día y 1 hora antes (sin configuración manual)
- Filtro por etiqueta y búsqueda
- Los eventos no se marcan como completados, solo se archivan en "Pasados"

---

## Backend — Endpoints por archivo

```
auth.py              POST /auth/register, POST /auth/login, GET /auth/me
accounts.py          CRUD /accounts/ + POST /accounts/{id}/pay-month + POST /accounts/{id}/liquidate
recurring_expenses.py  CRUD /recurring-expenses/
installment_purchases.py  CRUD /installment-purchases/ + POST /{id}/mark-paid + POST /{id}/liquidate
savings_goals.py     CRUD /savings-goals/ + POST /{id}/contribute
monthly_income.py    GET /monthly-income/, PUT /monthly-income/
projection.py        GET /projection/, POST /projection/simulate/
expenses.py          GET /expenses/, POST /expenses/, DELETE /expenses/{id}
incomes.py           GET /incomes/, POST /incomes/, DELETE /incomes/{id}
credit_payments.py   GET /credit-payments/, POST /credit-payments/
push.py              GET /push/vapid-public-key, POST /push/subscribe, DELETE /push/unsubscribe
tasks.py             CRUD /tasks/ + POST /{id}/complete + subtasks CRUD
notes.py             CRUD /notes/ + POST /{id}/toggle-pin
habits.py            GET /habits/?week_start=YYYY-MM-DD, POST /habits/, DELETE /habits/{id}, POST /habits/{id}/toggle
```

Todos requieren `Authorization: Bearer <token>` excepto `/auth/register` y `/auth/login`.

---

## Base de datos — Modelos principales

| Tabla | Descripción clave |
|---|---|
| `users` | email + password hash |
| `accounts` | tipo: `checking / savings / credit_card`; crédito tiene `credit_limit`, `current_balance_used`, `closing_day`, `payment_day` |
| `monthly_income` | un registro por usuario; tiene `amount`, `cycle_start_day` (1–31, default 1) y `account_id` opcional. Si la cuenta es de ahorro, el ingreso mensual NO cuenta para disponible. |
| `recurring_expenses` | frecuencia: `monthly / weekly / custom` |
| `installment_purchases` | MSI; `remaining_installments`, `paid_month/paid_year` para control de "ya pagué este mes" |
| `savings_goals` | `current_amount`, `monthly_contribution`, `contributed_month/year/last_contribution_amount` |
| `expenses` | gastos diarios; `payment_method`: `cash / debit / credit / savings`; crédito tiene `credit_statement_month/year`; savings descuenta de la cuenta de ahorro pero NO del disponible del mes |
| `incomes` | ingresos puntuales (no el fijo mensual); tienen `account_id` opcional: si es cuenta de ahorro NO cuenta para disponible, si es débito/null SÍ cuenta |
| `credit_payments` | registro de pagos de tarjeta por `statement_month/year` |
| `push_subscriptions` | endpoint VAPID por usuario, para notificaciones push |
| `notes` | título, contenido, etiqueta, color (string key), is_pinned; FK a users |
| `habits` | nombre, color (hex), FK a users |
| `habit_logs` | FK a habits, date (Date); constraint unique (habit_id, date) — un log por hábito por día |

Migraciones numeradas `0001`–`0020` en `backend/alembic/versions/`.

**Lógica de ciclo financiero:** Toda la proyección y cálculos se basan en ciclos definidos por `cycle_start_day`, no por meses calendario. El ciclo actual corre desde `cycle_start_day` del mes anterior/actual hasta el día antes del siguiente `cycle_start_day`. `MonthProjection` incluye `cycle_start`, `cycle_end` y `cash_debit_spent`. La home page usa `GET /projection/?months=1` en lugar de calcular localmente.

---

## Frontend — Estructura de archivos

```
frontend/
├── app/
│   ├── (auth)/login/page.tsx       # Login
│   ├── (auth)/register/page.tsx    # Registro
│   ├── page.tsx                    # Home / — dashboard personal central
│   ├── dashboard/page.tsx          # App principal de finanzas (~1200 líneas)
│   ├── simulador/page.tsx          # Simulador MSI (página legacy, el simulador ya vive en /dashboard)
│   ├── to_do/page.tsx              # Tareas
│   ├── events/page.tsx             # Eventos (reutiliza API de tasks con is_event)
│   ├── focus/page.tsx              # Espacio Focus (Three.js, Pomodoro, sonidos)
│   ├── notas/page.tsx              # Notas con colores
│   ├── habitos/page.tsx            # Tracker semanal de hábitos
│   ├── layout.tsx                  # Root layout con ThemeProvider
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx           # Wrapper con Sidebar, protege rutas autenticadas
│   │   └── Sidebar.tsx             # Nav lateral (desktop) / hamburguesa (móvil)
│   ├── charts/
│   │   ├── ProjectionChart.tsx     # Barras SVG 12 meses
│   │   └── SpendingTimelineChart.tsx  # Step-line SVG gastos del período
│   ├── ui/
│   │   ├── custom-select.tsx       # Dropdown custom (reemplaza <select> nativo)
│   │   ├── glass-card.tsx          # Card con efecto glassmorphism
│   │   └── ...                     # button, card, dialog, input, label
│   ├── QuickTransactionFAB.tsx     # Botón flotante para registrar transacción rápida
│   └── ThemeProvider.tsx
├── lib/
│   ├── api.ts                      # Todas las llamadas al backend (fetch con JWT)
│   ├── types.ts                    # Interfaces TypeScript de todos los modelos
│   ├── push.ts                     # Helpers VAPID: suscribir, desuscribir, verificar soporte
│   └── utils.ts
└── public/
    ├── sw.js                       # Service Worker: push notifications + PWA offline
    ├── manifest.json               # PWA manifest
    └── sounds/                     # MP3s para el mezclador de /focus
        └── lluvia.mp3, olas.mp3, viento.mp3, cascada.mp3, aves.mp3, fuego.mp3
```

---

## Convenciones importantes

**TypeScript:**
- Siempre `useState<Tipo>(valor)` con genérico explícito
- Para updates de estado con tipos union nullable: spread directo `setForm({...form, field: val})`, no callback form
- No `any`

**Tipografía:**
- Fuente principal: `Space Grotesk` (weights 300–700) — cargada via Google Fonts en `layout.tsx`, aplicada como `font-sans` globalmente
- Fuente secundaria cargada pero no usada como principal: `Nunito`

**Estilos:**
- Glassmorphism: `bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl`
- Fondo base dark: `#0A0A0A`
- Acento principal (morado): `#6B46E5` (dark: `#AF9BFF`)
- Positivo: `#A8FF3E`, Negativo: `#FF4444` / `#FF6B6B`
- Soporte dark/light mode con Tailwind `dark:` — el toggle está en el header del dashboard

**Fechas:**
- Formato de display siempre `dd/mm/yyyy` (ej: `07/07/2026`). Nunca mostrar `mm/dd/yyyy` ni ISO crudo `yyyy-mm-dd`.
- Para inputs de fecha usar el componente `<DateInput>` de `@/components/ui/date-input` — muestra `dd/mm/aaaa`, acepta escritura directa con auto-formato, tiene botón de calendario, y retorna/recibe `yyyy-mm-dd` internamente.
- Para formatear fechas ISO a display usar: `iso.split('-').reverse().join('/')` o una función `fmtDate`.
- El backend siempre recibe y guarda fechas en formato `yyyy-mm-dd`. El display es solo responsabilidad del frontend.

**Gráficas:**
- SVG puro, sin librerías externas de charts

**Docker (workflow de desarrollo):**
- Cambios de código TypeScript/Python: `docker cp` al contenedor para probar rápido, luego `docker compose build` para persistir
- Cambios de dependencias (`requirements.txt` o `package.json`): siempre `docker compose build`
- Nunca hay volume mounts de código fuente en docker-compose

**Agregar una nueva página:**
1. Crear `frontend/app/<nombre>/page.tsx`
2. Agregar la ruta al array `NAV` en `frontend/components/layout/Sidebar.tsx`
3. Envolver con `<AppLayout>` si requiere autenticación

**Agregar un nuevo módulo backend:**
1. Modelo en `backend/app/models/<nombre>.py`
2. Schema Pydantic en `backend/app/schemas/<nombre>.py`
3. Servicio en `backend/app/services/<nombre>_service.py`
4. Endpoint en `backend/app/api/v1/endpoints/<nombre>.py`
5. Registrar en `backend/app/api/v1/router.py`
6. Migración: `docker compose exec backend alembic revision --autogenerate -m "descripcion"` → `alembic upgrade head`

---

## Lo que viene (visión del usuario)

Sebastian quiere que FRIDAY sea su app personal completa. Todos los módulos planeados están construidos. El siguiente paso es lo que Sebastian decida. 🚀

Todo va en el mismo repo/contenedores. No separar en microservicios.

---

## Deploy en producción — EC2 (OPERATIVO)

**Estado:** App 100% operativa en producción.

**URL:** `https://sebitass47.com`

**Repositorio GitHub:** `https://github.com/Sebitass47/friday.git`

**Servidor:**
- Proveedor: AWS EC2
- Tipo: **t3.small** (2 GB RAM)
- IP fija (Elastic IP): `18.216.94.204`
- OS: Amazon Linux 2023
- Key pair: `\\wsl.localhost\Ubuntu\home\sebitass47\.ssh\friday-key.pem`
- Usuario SSH: `ec2-user`
- Conexión: `ssh -i ~/.ssh/friday-key.pem ec2-user@18.216.94.204`

**Dominio:**
- `sebitass47.com` en Namecheap
- DNS apunta a `18.216.94.204` (registros A para `@` y `www`)
- SSL activo con Let's Encrypt / Certbot

**Stack en producción:**
- Docker Compose con `docker-compose.yml` + `docker-compose.prod.yml`
- nginx como reverse proxy (80/443 → contenedores)
- Migraciones aplicadas hasta `0017`

**Para deploys futuros:**
```bash
ssh -i ~/.ssh/friday-key.pem ec2-user@18.216.94.204
cd FRIDAY
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build <servicio>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps <servicio>
```
