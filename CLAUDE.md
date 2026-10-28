# FRIDAY — Contexto para agentes

> **Instrucción para el agente:** Al terminar cualquier tarea:
> 1. **Actualiza este archivo** — si agregaste módulo, endpoint, modelo, página o componente, añádelo en la sección correspondiente. Si completaste algo de "Lo que viene", muévelo a donde corresponda.
> 2. **Haz un commit** con un mensaje descriptivo de lo que se hizo (en inglés, estilo convencional: `feat:`, `fix:`, `docs:`, etc.). Siempre incluye `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
> 3. **NUNCA hagas cambios directos en producción.** Todo cambio va en local → commit → push → el pipeline de GitHub Actions se encarga del deploy. Jamás corras comandos en el server de EC2 (ni `git pull`, ni `docker compose build`, ni `docker exec`). El único caso válido para conectarse al server es **leer logs** cuando hay un error que no se puede diagnosticar de otra forma, y solo si Sebastian lo autoriza explícitamente.
> 4. **NUNCA toques `docker-compose.yml` ni `docker-compose.prod.yml`** sin autorización explícita de Sebastian. Estos archivos controlan producción y un cambio incorrecto puede romper el acceso al servidor.
> 5. El pipeline de CI/CD (`.github/workflows/deploy.yml`) se dispara automáticamente con cada push a `main`. Hace `git pull` en el server, reconstruye y reinicia todos los contenedores, y aplica migraciones. Confía en el pipeline.



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
- **Finanzas del mes** — usa el mismo `CycleSummaryCard` que `/dashboard` (línea de saldo + desglose plegable) y muestra chips de "Pagos próximos" de tarjeta (≤7 días) entre la gráfica y el botón de desglose
- **Recordatorios de hoy** — tareas con `due_date = hoy` que no están completadas
- **Próximos 7 días** — eventos ordenados por fecha con badge relativo (Hoy / Mañana / Mié…)
- **Notas recientes** — notas creadas hace menos de 7 días, mini-cards con color de fondo

**Layout escritorio (`xl`):** cuadrícula de 12 columnas, ancho hasta 1600px. Fila 1: Recordatorios (3) · Finanzas (6, partida en gráfica + desglose siempre visible vía `splitOnWide`) · Próximos 7 días (3). Fila 2: Hábitos y Listas 50/50; si hay notas recientes, Listas · Hábitos · Notas (4/4/4). En celular/tablet Finanzas va primero (el orden en `xl` se logra con `xl:order-*`). Listas muestra 7 en `xl` y 5 en el resto.

**Tu progreso** (franja al final, 100% de ancho en `xl`): racha de hábitos, % de hábitos a 30 días, recordatorios cumplidos de la semana, elementos tachados en listas y gasto vs ciclo pasado. Todo clicable → `/estadisticas`. **Campana** en el header (`components/DigestControls.tsx` + `DigestSettings.tsx`): activa/desactiva y configura hora del resumen semanal, con botón "Enviarme uno ahora" y vista previa.

**FAB speed-dial** (bottom-right, siempre visible):
- Botón + con gradiente rosa-morado; al abrir rota a X y expande 4 opciones animadas
- 💸 Gasto → `/dashboard?new=1` (abre QuickTransactionFAB automáticamente)
- ✅ Recordatorio → `/recordatorios?new=1` (abre panel de crear recordatorio)
- 📅 Evento → `/events?new=1` (abre panel de crear evento)
- 📝 Nota → `/notas?new=1` (abre formulario de nueva nota)

**Auto-open `?new=1`:** implementado en QuickTransactionFAB, recordatorios, events y notas — al llegar con ese param el formulario se abre solo.

### Finanzas (`/dashboard`)

Todo vive en `frontend/app/dashboard/page.tsx` (un archivo grande, ~1200 líneas). Los datos se cargan en `loadAll()` al montar.

**KPIs del header:**
- Disponible este mes (ingreso − compromisos − gastos cash/débito del mes)
- Ingreso mensual (editable con lápiz — modal `edit-income`)
- Total compromisos

**Resumen del ciclo** (`components/CycleSummaryCard.tsx`) es una sola tarjeta que reemplaza las 3 KPI y la gráfica aparte: arriba la línea de saldo (`BalanceFlowChart`) con el disponible; botón "Ver desglose" (plegado por default) despliega Ingreso mensual (editable) + Ingresos variables (expandible, sin cuentas de ahorro) = Total ingresos − Compromisos − Gastado. Los ingresos variables usan la misma regla que el backend (`account_id` nulo o cuenta de débito; del inicio del ciclo a hoy).

**Secciones:**
- Línea de saldo (`BalanceFlowChart.tsx`, dentro del resumen del ciclo) — línea suave y neutra del saldo disponible: arranca con ingreso − compromisos, sube con ingresos puntuales y baja con gastos (cash/débito por fecha, crédito por statement del ciclo; mismas reglas que `/projection/`, termina en `available`). Scrub con mouse/touch, badge de % vs inicio, resumen Inicio/↑/↓. Reemplazó al Spending Timeline y a la tarjeta de ritmo
- Gastos por categoría — chips para ocultar/mostrar categorías (barras y chips en blanco/negro neutro, guardado en localStorage `friday_hidden_categories`, `Transferencia` oculta por default); % recalculado sobre lo visible
- Tarjetas de crédito — badge de uso con color dinámico (≤33% morado, 33–66% ámbar, >66% rojo), botón "Pagar este mes" que abre modal con monto y nuevo saldo
- MSI (Meses Sin Intereses) — CRUD completo, botón "Liquidar"
- Metas de ahorro — CRUD completo, botón "Ahorré este mes" (modal con monto editable)
- Gastos recurrentes — CRUD completo
- Cuentas — CRUD completo (débito, ahorro, crédito)
- Proyección 12 meses — `ProjectionChart.tsx`, gráfica de barras SVG pura (al fondo de la página)
- Simulador MSI — integrado al fondo, después de la proyección (ya no es página separada)

**Deuda automática del ciclo:** tarea Celery `carry_over_negative_balance` (23:55 hora MX, `app/tasks.py`). El último día de cada ciclo, si el disponible es negativo, crea un gasto en efectivo sin cuenta, categoría `Deuda`, nombre "Deuda del ciclo anterior", fechado el primer día del ciclo nuevo, por el monto adeudado (idempotente por usuario/fecha). El usuario puede borrarlo si no lo quiere.

**Registrar transacción** (botón "Registrar" en header + FAB flotante `QuickTransactionFAB.tsx`):
- Gasto: efectivo / débito / crédito, categoría opcional
- Ingreso puntual: descripción, monto, categoría
- Toggle "¿Es tu ingreso mensual fijo?" → guarda en `monthly_income` con `income_start_day`

### Simulador (sección dentro de `/dashboard`)

Ya no es una página separada. Vive al final de la página de Finanzas, debajo de la Proyección 12 meses. Simula el impacto de una compra a MSI en los próximos 12 meses. Llama a `POST /projection/simulate/`.

### Gastos compartidos, cobros y Cierre (`/dashboard/cierre`)

Para cuando prestas la tarjeta, divides una cuenta o compras un MSI con alguien.

**⚠️ Convención clave:** `Expense.amount` y `InstallmentPurchase.monthly_amount` siguen siendo **TU parte**, así que todo lo de disponible/proyección/gráficas/estadísticas no cambió. Lo de los demás vive en `person_debts` (gastos) e `installment_shares` (MSI). Lo que el banco realmente cobra = tu parte + las de los demás (`debt_service.expense_total` / `total_monthly`), y **eso** es lo que mueve `current_balance_used` / `balance` al crear, editar y borrar (nunca uses solo `amount` para saldos de cuentas). Un gasto 100% de otra persona tiene `amount = 0`.

- **Personas** (`people`): solo un nombre, sin cuenta de FRIDAY. Se crean al vuelo desde el selector (`SplitPicker`, que autocompleta con las existentes).
- **Registrar** (modal "Registrar" de `/dashboard`): el monto que escribes es lo que cobra el banco; el selector ofrece *Todo mío · Dividir (por "partes", ej. yo 2 / ella 1) · Personalizado (montos exactos) · De alguien más*. El front manda `amount` = tu parte y `shares` = las de los demás (`lib/split.ts`, `computeSplit`). Igual en el modal de MSI (reparto de cada pago mensual → una deuda por mensualidad restante, con su statement según el día de corte).
- **Cobro** (3ª pestaña del modal Registrar, `CobroForm`): eliges persona, marcas qué te pagó (autocompleta el monto) o escribes un monto suelto; lo que sobra se aplica a lo más antiguo (FIFO). `person_payments` + `payment_allocations`. **No es un `Income`**: no sube el disponible; si eliges cuenta de depósito sí suma a su `balance`. Si borras un cobro se deshace todo.
- **Cierre** (`/dashboard/cierre`, botón "Cierre" en el header de Finanzas con chip "Te deben $X"; tocar el nombre de una persona **despliega debajo de su fila** (`PersonDetails`, no una ventana) sus movimientos: en "Personas en este cierre" los de todas las tarjetas agrupados por tarjeta, y dentro de cada tarjeta solo los de esa tarjeta, con pagado/pendiente): por *estado de cuenta* (mes/año del statement; abre en el último corte ya pasado, con flechas ±1 mes). Por tarjeta: pagar al banco, tuyo / de otros / de MSI, "Te depositan" por persona (Cobrar / Listo ✓), movimientos con a quién le toca cada parte, y **total real del estado de cuenta** (`statement_checks`) con la diferencia ("Faltan $X por registrar" / "Cuadra con el banco").
- **Recurrentes compartidos** (ej. Totalplay $1,250 en tu tarjeta, tu mamá paga $1,100): `RecurringExpense.amount` también es **tu parte** (por eso el compromiso del ciclo ya cuenta solo tus $150) y las de los demás van en `recurring_shares`. Cada cobro genera una fila en `recurring_charges` (única huella de un recurrente en el estado de cuenta, porque los recurrentes **no crean `Expense`**) y una deuda por persona ("Totalplay · oct 2026"). La tarjeta se carga por tu parte + las de ellos, tanto al crearlo como en la tarea diaria `charge_recurring_expenses`, que ahora también procesa los recurrentes divididos sin tarjeta. Sigue habiendo **un cobro por ciclo sea cual sea la frecuencia** (así ya funcionaba con el saldo de la tarjeta). Cambiar el reparto solo afecta cobros futuros; si borras el recurrente, lo que ya te debían se conserva (`recurring_charges.recurring_id` es `SET NULL`). El Cierre muestra estos cargos como "Recurrente". `recurring_charges` solo existe desde la migración 0028, así que para los recurrentes de tarjeta **sin cobro registrado en ese estado de cuenta** (los creados antes, o un statement al que la tarea diaria aún no llega) `closing_service` **estima** el cargo desde el propio recurrente (1 vez si es mensual, `días//7` semanal, `días//intervalo` custom; solo si ya existía antes del fin del periodo) y lo marca `estimated` ("Recurrente (estimado)"). Los estimados suman a tuyo/total pero no generan deudas.
- **Fechas futuras:** una deuda solo es cobrable ("te deben", `pending_total`, chip de Finanzas) desde su `charge_date`. Un MSI compartido que empieza en el futuro (o mensualidades de meses por venir) genera sus deudas de inmediato, pero caen en el cierre del statement que corresponda (ej. inicio 15/11 con corte el 12 → cierre de **diciembre**, no noviembre). Si cambias fecha de inicio, número de pagos o tarjeta de un MSI, `rebuild_installment_debts` rehace las deudas que no tienen cobros aplicados para que sigan el nuevo calendario (las ya cobradas quedan como historial). (Se probó mostrar "Próximos cobros" en el Cierre y Sebastian lo descartó: no lo vuelvas a agregar.)
- Reparto bloqueado si el gasto ya tiene cobros aplicados (400). **Movimientos** (recientes y "Todos"): columna "de quién" (`ownerOf`): *Tú*, *Tú + Armando* o solo la persona; si es 100% de otro se muestra el total del cargo (no "$0") en azul (`OTHER_COLOR`, ni verde ni rojo). **Editar un gasto** (modal "Editar gasto") también trae el selector: el campo Monto muestra lo que cobró el banco y el reparto se reconstruye desde `shares`; el front solo manda `shares` si cambiaron (así editar nombre/monto de un gasto con cobros aplicados no falla). Pendiente: exportar el cierre a Excel.

### Recordatorios (`/recordatorios`)

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
- Cada hábito tiene sus **días de la semana** (`days_of_week`, 0=Lun…6=Dom): presets Todos los días / Entre semana / Fines de semana o días sueltos (selector `DaysPicker`, también al crear). Se cambia tocando la etiqueta de días bajo el nombre del hábito. En los días que no aplican la celda sale en blanco, sin casilla; `%`, racha, "completados hoy" y los push solo cuentan los días programados; el backend rechaza (400) marcar un día no programado
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

### Listas (`/listas`)

Listas atemporales (compras, películas por ver, libros, viajes…). Mismo layout que `/events` y `/recordatorios` (hero, buscador, panel lateral en escritorio / hoja desde abajo en celular), en escala de grises. **No usa la API de tareas**: tiene tablas propias, así no se mezcla con recordatorios ni con el Inicio/Focus.

**Funcionalidades:**
- Cada lista tiene emoji (picker de 30 + campo para pegar cualquiera) y nombre
- Tarjeta con barra de progreso y badge de pendientes; al hacer clic abre el panel con los elementos
- Elementos: clic para marcar/desmarcar (optimista), editar texto (lápiz), borrar, agregar con Enter; pendientes arriba y "Completados (n)" abajo con botón Limpiar
- Renombrar/cambiar emoji desde el panel; borrar lista con doble clic en el bote
- Orden por `updated_at` (cualquier cambio en sus elementos la sube)
- En la tarjeta, "de <dueño>" (lista compartida contigo) va en una línea bajo el nombre y se trunca, para no aplastar el título en celular
- `?new=1` abre el panel de crear; `?open=<id>` abre una lista (lo usa el Inicio)
- Inicio: card "Listas" con las 5 más recientes (emoji + nombre + pendientes) → `/listas?open=<id>`

**Archivos:** `frontend/app/listas/page.tsx` (ListCard + ListPanel + ItemRow inline), `backend/app/{models/user_list.py, schemas/user_list.py, services/user_list_service.py, api/v1/endpoints/lists.py}`

### Compartir (recordatorios, eventos, listas y notas)

Cada elemento **le pertenece a quien lo crea** y puede compartirse **por elemento** con otros usuarios de FRIDAY. Los hábitos NO se comparten (cada quien lleva sus propios registros).

- Se comparte **por correo**: la persona debe tener cuenta de FRIDAY (el registro es por invitación, así que no se crean cuentas al invitar). Si el correo no existe sale "No hay ningún usuario de FRIDAY con ese correo".
- Al compartir, esa persona queda guardada como **contacto** del dueño y aparece como chip "Sugeridos" en el selector la próxima vez (no hay que volver a escribir el correo). Se puede compartir con varias personas.
- `ShareSection` (`components/ShareSection.tsx`) es el selector reutilizable: chips de personas, sugeridos, input de correo. Va en el panel de Eventos, Recordatorios y Listas, y en el formulario de Notas. Al **crear**, junta las personas y las comparte al guardar; al **editar** (dueño), comparte/quita al instante.
- **Permisos:** el dueño y los invitados ven y editan igual (título, fecha, completar, subtareas, elementos de lista, contenido y fijado de notas). Solo el **dueño** puede borrar y administrar con quién se comparte. El invitado ve "Lo compartió contigo X" y un botón **Dejar de ver** (se quita a sí mismo).
- Indicador en las tarjetas: 👥 N (dueño con N personas) o "de <nombre>" (compartido contigo).
- **Notificaciones push:** los avisos de recordatorios y eventos compartidos le llegan al dueño y a todos los invitados (`_task_subscriptions` en `tasks.py`).
- Backend: tablas `shares` (polimórfica: `resource_type` `task`|`list` + `resource_id`) y `contacts`; `share_service.py` (acceso, anotado de `is_owner/owner_name/shared_with`, share/unshare, contactos); las consultas de tareas y listas incluyen lo compartido contigo vía `_access()`.

### Estadísticas (`/estadisticas`)

Tres pestañas, todo se calcula en el backend (`stats_service.py`, `GET /stats/`) y las gráficas son SVG/divs puros:
- **Hábitos:** racha actual y mejor (días con ≥1 hábito hecho), % semana y 30 días, días perfectos, mapa de calor de 12 semanas (verde), cumplimiento por semana (8), mejor/peor día de la semana y detalle por hábito (racha, récord, %). Respeta `days_of_week` y no cuenta días anteriores a la creación del hábito.
- **Recordatorios y listas:** recordatorios cumplidos / no cumplidos (semana y 30 días), % de cumplimiento, vencidos ahora; elementos tachados (semana y 30 días), pendientes y listas completas. **Solo números**, sin gráficas.
- **Finanzas:** últimos 6 ciclos (ingreso vs gastado vs lo que sobró), gastado vs el ciclo anterior *hasta el mismo día*, gasto diario promedio y categorías (barra gris = ciclo pasado). Excluye categorías `Transferencia` y `Deuda`; el gasto cuenta por fecha del gasto (crédito incluido), no por statement.

**Historial (`activity_log`):** el estado actual no dice *cuándo* se completó algo, así que `activity_service.log/unlog` guarda un registro append-only: `task_done` (también recurrentes), `task_missed` (lo registra la tarea de medianoche al saltar una ocurrencia recurrente sin completar; los pendientes vencidos no recurrentes se cuentan en vivo) y `list_item_done` (sobrevive a "Limpiar completados"). Se llena en `complete_task`/`update_task`/`update_item`; la migración 0026 rellena lo ya completado con `updated_at` como mejor aproximación.

### Resumen semanal (push)

Domingo = "tu semana" (eventos, recordatorios por hacer, pagos de tarjeta, cierre de ciclo y cuánto te queda); viernes = "es viernes" (hoy y fin de semana, hábitos de la semana, lo cumplido/tachado y cuánto te queda). Son plantillas sobre datos propios (`digest_service.py`), **sin IA**. Celery Beat corre `send_weekly_digests` cada hora en punto y cada usuario recibe el suyo cuando coincide día y hora con su `digest_settings` (defaults: domingo 19:00, viernes 8:00, activado para quien tenga push; `last_sent_key` evita duplicados). **Dos versiones del texto:** la **notificación es corta** (`build_push`: una línea principal + cuánto te queda + "Toca para ver el resumen completo", porque las notificaciones se colapsan a ~2 líneas) y el **resumen completo** vive dentro de la app (`build_digest`, todas las líneas). El push apunta a `/?digest=<kind>`, que abre el modal del resumen en el Inicio (`DigestControls.tsx` lee el param y limpia la URL). Por si la notificación no llega, el Inicio muestra un botón **"Resumen de hoy/de la semana"** junto a la campana **solo los días configurados** (viernes/domingo y con ese día activado). Desde los ajustes de la campana también hay "Ver completo".

Endpoints: `GET/PUT /digest/settings`, `GET /digest/preview?kind=` (resumen completo), `POST /digest/test?kind=sunday|friday&send=true|false` (genera/envía la versión corta).

### Notificaciones de compartir y cambios

- Al **compartir** algo contigo (recordatorio, evento, lista o nota) te llega un push inmediato "👥 X compartió contigo…".
- Cuando alguien **modifica** algo compartido (cualquier edición, completar, subtareas, elementos de lista) los demás reciben "✏️ X actualizó la lista…". **Se agrupan 60 s** (`notify_service.record_change`): las ediciones del mismo elemento se juntan en un set de Redis y un solo task las envía; nunca se notifica a quien editó.
- **Cola:** las rutas solo *encolan* en Celery (`send_notification`, `flush_resource_changes`), así que un push lento nunca bloquea una petición. No hay cola/worker aparte: usa el worker existente.
- **Al hacer clic** una notificación abre la página de su `url` (`/recordatorios`, `/events`, `/listas?open=<id>`, `/notas`, `/` para el resumen). `sw.js` espera `client.navigate()` y, si falla (PWA instalada), pide a la página que navegue por `postMessage` (`SWRegister.tsx`).

### Eventos (`/events`)

Lista de eventos tipo calendario. Mismo diseño que `/recordatorios` pero para cosas con fecha fija (citas, reuniones, etc.). **No tiene endpoint propio en el backend** — reutiliza la API de tareas (`/tasks/`) filtrando por `is_event=true`.

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
lists.py             GET/POST /lists/, PUT/DELETE /lists/{id}, POST /lists/{id}/items, PUT/DELETE /lists/{id}/items/{item_id}, POST /lists/{id}/clear-completed
stats.py             GET /stats/ (hábitos, recordatorios, listas y finanzas en una sola respuesta)
people.py            CRUD /people/, GET /people/{id}/pending, GET|POST /people/{id}/payments, DELETE /people/payments/{id}, GET /closing/?month=&year=, PUT /closing/check
digest.py            GET/PUT /digest/settings, POST /digest/test?kind=&send=
shares.py            POST /shares/lookup, POST /shares/ {resource_type, resource_id, email}, DELETE /shares/{type}/{id}/{user_id}, GET /contacts/, DELETE /contacts/{user_id}
habits.py            GET /habits/?week_start=YYYY-MM-DD, POST /habits/, PUT /habits/{id}?week_start=, DELETE /habits/{id}, POST /habits/{id}/toggle
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
| `habits` | nombre, color (hex), `days_of_week` ("0,1,2,3,4", 0=Lun), FK a users |
| `shares` | elemento compartido: `resource_type` (`task`/`list`/`note`), `resource_id`, `owner_id`, `shared_with_id`; unique por (tipo, id, persona) |
| `contacts` | personas con las que el usuario ya compartió (`owner_id`, `contact_user_id`) |
| `lists` | name, emoji, FK a users; `updated_at` se actualiza al cambiar sus elementos |
| `list_items` | FK a lists, text, is_done, position |
| `people` | personas con las que compartes gastos (solo nombre, `user_id`) |
| `person_debts` | lo que una persona te debe: su parte de un gasto (`expense_id`), de una mensualidad MSI (`installment_id` + `installment_index`) o de un cobro recurrente (`recurring_charge_id`); `settled_amount`, `charge_date`, `account_id` y `statement_month/year` para agrupar por cierre |
| `installment_shares` | parte mensual de cada persona en un MSI |
| `person_payments` / `payment_allocations` | cobros recibidos y a qué deudas se aplicaron |
| `recurring_shares` / `recurring_charges` | parte de cada persona en un recurrente / bitácora de cada cobro recurrente (nombre, tarjeta, statement, tu parte y total) |
| `statement_checks` | total real del estado de cuenta por tarjeta+mes (para calcular la diferencia) |
| `activity_log` | historial append-only para estadísticas: `kind` (`task_done`/`task_missed`/`list_item_done`), `resource_id` (sin FK, sobrevive a borrados), `due_date`, `occurred_at` |
| `digest_settings` | un registro por usuario: `enabled`, `sunday_on/hour`, `friday_on/hour`, `last_sent_key` |
| `habit_logs` | FK a habits, date (Date); constraint unique (habit_id, date) — un log por hábito por día |

Migraciones numeradas `0001`–`0028` en `backend/alembic/versions/`.

**Zona horaria:** los contenedores corren en UTC. Nunca uses `date.today()` en el backend; usa `today_local()` de `app/core/clock.py` (America/Mexico_City). Si no, después de las 18:00 hora MX el backend ya cree que es el día siguiente (y puede saltar de ciclo).

**MSI pagado:** "Pagado este mes" es solo visual para el disponible: la cuota sigue contando como compromiso del ciclo actual (pagarla no registra gasto). `_installment_cost_for_cycle` deshace el decremento de `remaining_installments` hecho en el ciclo actual al atribuir cuotas a ciclos.

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
│   ├── recordatorios/page.tsx      # Recordatorios
│   ├── events/page.tsx             # Eventos (reutiliza API de tasks con is_event)
│   ├── focus/page.tsx              # Espacio Focus (Three.js, Pomodoro, sonidos)
│   ├── notas/page.tsx              # Notas con colores
│   ├── habitos/page.tsx            # Tracker semanal de hábitos
│   ├── estadisticas/page.tsx       # Estadísticas (Hábitos · Recordatorios y listas · Finanzas)
│   ├── dashboard/cierre/page.tsx   # Cierre de tarjetas (qué pagar, qué te deben, diferencia con el banco)
│   ├── listas/page.tsx             # Listas con emoji y elementos marcables
│   ├── layout.tsx                  # Root layout con ThemeProvider
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx           # Wrapper con Sidebar, protege rutas autenticadas
│   │   └── Sidebar.tsx             # Nav lateral (desktop) / hamburguesa (móvil)
│   ├── charts/
│   │   ├── ProjectionChart.tsx     # Barras SVG 12 meses
│   │   ├── BalanceFlowChart.tsx    # Línea de saldo del ciclo (ingresos/gastos)
│   │   └── CategorySpendingChart.tsx  # Barras por categoría con filtro de categorías
│   ├── ui/
│   │   ├── custom-select.tsx       # Dropdown custom (reemplaza <select> nativo)
│   │   ├── glass-card.tsx          # Card con efecto glassmorphism
│   │   └── ...                     # button, card, dialog, input, label
│   ├── SplitPicker.tsx             # Selector Todo mío / Dividir / Personalizado / De alguien más + personas
│   ├── CobroForm.tsx               # Registrar un cobro (alguien te pagó)
│   ├── DigestControls.tsx          # Campana + botón "Resumen" (días configurados) + modal del resumen completo
│   ├── DigestSettings.tsx          # Modal de ajustes del resumen semanal (lo controla DigestControls)
│   ├── ShareSection.tsx            # Selector para compartir (personas, sugeridos, correo)
│   ├── CycleSummaryCard.tsx        # Resumen del ciclo (disponible + desglose de ingresos/compromisos/gastos)
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
- Tailwind v4 ya no pone cursor de mano en los botones: `globals.css` lo restaura para todo `button`/`[role=button]` habilitado (no hace falta `cursor-pointer` suelto)
- Glassmorphism: `bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl`
- Fondo base dark: `#0A0A0A`
- Acento principal (morado): `#6B46E5` (dark: `#AF9BFF`) — en `/dashboard` y sus componentes (`components/ui/*`, gráficas) el acento es escala de grises (negro en light, blanco en dark), igual que en sidebar, `/events`, `/recordatorios` y `/listas` (las etiquetas conservan sus colores); el morado queda en el resto (Notas, Focus…). Los colores semánticos (verde/rojo/ámbar) se mantienen
- Positivo: `#A8FF3E`, Negativo: `#FF4444` / `#FF6B6B`
- Soporte dark/light mode con Tailwind `dark:` — el toggle está en el header del dashboard
- **Liquid glass:** clase `.glass` (`globals.css`, dentro de `@layer components` para que las utilidades de Tailwind puedan sobreescribirla) en todos los cards de Inicio, Finanzas, Recordatorios/Eventos (cada fila), Hábitos, Listas y Notas (pasteles translúcidos + blur). `AmbientGlow` (`components/layout/AmbientGlow.tsx`, montado en `AppLayout`) pinta tres resplandores fijos morado/rosa/azul detrás del contenido para que el vidrio tenga qué refractar. **Se quedan quietos a propósito**: se probó moverlos como líquido y Sebastian prefirió que no; no lo vuelvas a proponer (además cada card de vidrio re-desenfoca el fondo en cada cuadro, así que animarlo es caro en celulares de gama baja). Focus no usa `AppLayout`, así que no lo lleva. **No pongas fondos opacos (`bg-white`, `min-h-screen bg-…`) en el wrapper de una página**: tapan los resplandores

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
- **pip/certifi con hash (incidente eMudhra, oct 2026):** pip < 26.2.2 y certifi viejo siguen confiando en intermedias comprometidas (riesgo de MITM contra PyPI). `backend/Dockerfile` instala primero `requirements-bootstrap.txt` con `--require-hashes` (pip 26.2.2 + certifi 2026.10.19) y luego `requirements.txt`. Al subir esas versiones, actualiza los hashes desde `https://pypi.org/pypi/<paquete>/<versión>/json`. Pendiente: `--require-hashes` también para `requirements.txt`

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
