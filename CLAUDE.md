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

### Finanzas (`/dashboard`)

Todo vive en `frontend/app/dashboard/page.tsx` (un archivo grande, ~1200 líneas). Los datos se cargan en `loadAll()` al montar.

**KPIs del header:**
- Disponible este mes (ingreso − compromisos − gastos cash/débito del mes)
- Ingreso mensual (editable con lápiz — modal `edit-income`)
- Total compromisos

**Secciones:**
- Spending Timeline Chart — SVG paso a paso de gastos del mes, navegable por períodos, `cycleStartDay` guardado en localStorage (`friday_cycle_start_day`)
- Proyección 12 meses — `ProjectionChart.tsx`, gráfica de barras SVG pura
- Tarjetas de crédito — badge de uso con color dinámico (≤33% morado, 33–66% ámbar, >66% rojo), botón "Pagar este mes" que abre modal con monto y nuevo saldo
- MSI (Meses Sin Intereses) — CRUD completo, botón "Liquidar"
- Metas de ahorro — CRUD completo, botón "Ahorré este mes" (modal con monto editable)
- Gastos recurrentes — CRUD completo
- Cuentas — CRUD completo (débito, ahorro, crédito)

**Registrar transacción** (botón "Registrar" en header + FAB flotante `QuickTransactionFAB.tsx`):
- Gasto: efectivo / débito / crédito, categoría opcional
- Ingreso puntual: descripción, monto, categoría
- Toggle "¿Es tu ingreso mensual fijo?" → guarda en `monthly_income` con `income_start_day`

### Simulador (`/simulador`)

Página standalone. Simula el impacto de una compra a MSI en los próximos 12 meses. Llama a `POST /projection/simulate/`.

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
```

Todos requieren `Authorization: Bearer <token>` excepto `/auth/register` y `/auth/login`.

---

## Base de datos — Modelos principales

| Tabla | Descripción clave |
|---|---|
| `users` | email + password hash |
| `accounts` | tipo: `checking / savings / credit_card`; crédito tiene `credit_limit`, `current_balance_used`, `closing_day`, `payment_day` |
| `monthly_income` | un registro por usuario; tiene `amount` e `income_start_day` (1–28) |
| `recurring_expenses` | frecuencia: `monthly / weekly / custom` |
| `installment_purchases` | MSI; `remaining_installments`, `paid_month/paid_year` para control de "ya pagué este mes" |
| `savings_goals` | `current_amount`, `monthly_contribution`, `contributed_month/year/last_contribution_amount` |
| `expenses` | gastos diarios; `payment_method`: `cash / debit / credit`; crédito tiene `credit_statement_month/year` |
| `incomes` | ingresos puntuales (no el fijo mensual) |
| `credit_payments` | registro de pagos de tarjeta por `statement_month/year` |
| `push_subscriptions` | endpoint VAPID por usuario, para notificaciones push |

Migraciones numeradas `0001`–`0013` en `backend/alembic/versions/`.

---

## Frontend — Estructura de archivos

```
frontend/
├── app/
│   ├── (auth)/login/page.tsx       # Login
│   ├── (auth)/register/page.tsx    # Registro
│   ├── dashboard/page.tsx          # App principal de finanzas (~1200 líneas)
│   ├── simulador/page.tsx          # Simulador MSI
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
    └── manifest.json               # PWA manifest
```

---

## Convenciones importantes

**TypeScript:**
- Siempre `useState<Tipo>(valor)` con genérico explícito
- Para updates de estado con tipos union nullable: spread directo `setForm({...form, field: val})`, no callback form
- No `any`

**Estilos:**
- Glassmorphism: `bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl`
- Fondo base dark: `#0A0A0A`
- Acento principal (morado): `#6B46E5` (dark: `#AF9BFF`)
- Positivo: `#A8FF3E`, Negativo: `#FF4444` / `#FF6B6B`
- Soporte dark/light mode con Tailwind `dark:` — el toggle está en el header del dashboard

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

Sebastian quiere que FRIDAY sea su app personal completa. Los módulos planeados fuera de finanzas:

- **Lofi / ambiente** (`/lofi`) — imagen de fondo chill, sonidos de ambiente (lluvia, ciudad, café), reproducibles con mezcla de volúmenes
- **To-dos** — lista de tareas con recordatorios (push notifications ya están implementadas)
- **Mininotas** — notas rápidas tipo sticky notes

Todo va en el mismo repo/contenedores. No separar en microservicios.
