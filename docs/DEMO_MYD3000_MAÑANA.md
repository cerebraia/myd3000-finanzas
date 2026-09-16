# DEMO MYD3000 — GUIÓN DE PRESENTACIÓN

**Duración estimada:** 8–10 minutos  
**Resolución recomendada:** 1440 × 900 o 1366 × 768  
**Navegador:** Chrome/Edge — pestaña limpia, modo incógnito desactivado  
**Preparar antes:** Ver CHECKLIST_DEMO_MYD3000.md

---

## ⚠️ REQUISITO PREVIO — ANTES DE LA DEMO

**Ejecutar el bootstrap SQL esta noche** para que los módulos de cotizaciones y proyectos funcionen.

Ver instrucciones exactas en: `HITO15_DATABASE_AUDIT.md` → Sección "Orden de Ejecución"

**Mínimo para demo básica:** `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql`

**Sin ese paso, la demo solo puede mostrar:** Login + Dashboard + Lista de Clientes.

---

## FLUJO DE DEMO (orden sugerido)

---

### PANTALLA 1 — LOGIN

**Qué mostrar:**
- Pantalla de login limpia, logo MYD3000
- Ingresar credenciales

**Qué decir:**
> "Acceso interno de MYD3000. Solo usuarios autorizados."

**Qué evitar:** Mostrar la contraseña con pantalla compartida. Tipear con seguridad.

**Dato:** email y contraseña del administrador

---

### PANTALLA 2 — DASHBOARD

**Qué mostrar:**
- Saludo con nombre y fecha
- KPIs (Por cobrar, Por pagar, Proyectos activos, Vencidos)
- Pendientes de hoy
- Proyectos activos
- Botones de acción rápida

**Qué decir:**
> "Al entrar, Jefferson ve de inmediato qué necesita atención: cobros pendientes, pagos próximos, proyectos en curso. Sin navegar a nada."

**Si los datos están vacíos:** Mencionar que se cargará data real de los proyectos actuales.

**Qué evitar:** Mostrar KPIs con errores o NaN.

---

### PANTALLA 3 — CLIENTES

**Qué mostrar:**
- Lista de clientes
- Búsqueda en tiempo real

**Qué decir:**
> "Aquí están todos los clientes de MYD3000. Se puede buscar por nombre, documento o teléfono."

**Si la lista está vacía:**
> "Aún sin clientes cargados. Así es como se crea uno:"

**Acción demo — Crear cliente:**
- Click "+ Nuevo cliente"
- Nombre: **Marylin Sabino**
- Teléfono: (el que corresponda)
- Click "Guardar"
- Verifica que aparece en la lista

**Qué decir al crear:**
> "El número de cliente se genera automáticamente. CLI-0001."

---

### PANTALLA 4 — COTIZACIONES

**Qué mostrar:**
- Lista de cotizaciones (puede estar vacía)
- Estados claros: Borrador, En revisión, Aprobada, Rechazada

**Qué decir:**
> "Cada proyecto comienza con una cotización. Se puede gestionar el ciclo completo desde aquí."

**Acción demo — Crear cotización (solo si DB está completa):**
- Click "+ Nueva cotización"
- Cliente: Marylin Sabino
- Agregar 3 módulos (Cocina principal, Isla, Alacena)
- Total: $2,500
- Plan de pago: 80% anticipo ($2,000) / 20% final ($500)
- Guardar borrador → Enviar a revisión → Aprobar

**Si cotizaciones no funcionan (DB incompleta):**
> "Las cotizaciones se cargarán con los datos reales de los proyectos en curso."  
> **NO MOSTRAR UN ERROR.** Ir directamente a Proyectos.

---

### PANTALLA 5 — PROYECTOS

**Qué mostrar:**
- Lista de proyectos
- Número de proyecto (PR-2026-XXXX)
- Estado, cliente, monto

**Qué decir:**
> "Cada proyecto tiene un expediente completo: diseño, materiales, cobros, contrato, actividad."

**Acción demo — Crear proyecto manual (solo si DB completa):**
- Click "+ Nuevo proyecto"
- Cliente: Marylin Sabino
- Nombre: **Cocina Residencia Sabino**
- Tipo: Cocina
- Estado: Planificación
- Guardar → PR-2026-0001

**Dentro del proyecto — Tab "Proyecto / Diseño":**
- Mostrar la sección de adjunto
- "Aquí se adjunta el PDF del proyecto para control de versiones y aprobaciones"
- Si hay Storage configurado: adjuntar PDF de prueba
- Si no: mostrar el empty state profesional ("No hay un proyecto adjunto todavía.")

**Qué decir sobre el diseño:**
> "V1, V2, V3 — cada modificación crea una nueva versión. Se registra quién aprobó y cuándo."

---

### PANTALLA 6 — FINANZAS (opcional / avanzado)

**Solo mostrar si DB está completa y hay datos:**

- Cuentas por cobrar: saldo pendiente Marylin Sabino $2,000
- Registrar cobro $2,000 → saldo $500
- Cuentas por pagar: Giacomo, Giovanni
- Compromisos: Condominio, Corpoelec, FAOV

**Qué decir:**
> "El control de Giacomo y Giovanni está separado del control de la empresa. Cada uno tiene su propio resumen."

**Si finanzas no tienen datos:**
> "Aquí se registrarán todos los cobros y pagos del proyecto en tiempo real."

---

### PANTALLA 7 — CIERRE / DASHBOARD FINAL

**Volver al Dashboard.**

**Qué decir:**
> "Todo lo que acabo de hacer — el cliente, la cotización, el proyecto — ya aparece aquí actualizado, sin recargar la página. El sistema registra cada acción con fecha, hora y quién la realizó."

---

## PUNTOS CLAVE DE VENTA

1. **Todo en un lugar** — expediente completo del proyecto
2. **Control real** — Giacomo, Giovanni, empresa separados
3. **Versionado** — historial de diseños con aprobaciones
4. **Registro de actividad** — quién hizo qué y cuándo
5. **Sin Excel** — cotizaciones, cobros y pagos centralizados
6. **Acceso por roles** — Jefferson ve todo; operaciones ve solo lo suyo

---

## QUÉ NO MOSTRAR EN LA DEMO

| Módulo | Razón |
|--------|-------|
| Página de Reportes | Requiere datos reales acumulados |
| Configuración avanzada | No relevante para demo |
| Auditoría | Detalle técnico, no comercial |
| Console del navegador | Nunca durante demo |
| Supabase dashboard | Detalle técnico |
| Terminal o código | Solo si se pide arquitectura explícitamente |

---

## PLAN B — SI ALGO FALLA

| Problema | Solución |
|----------|---------|
| Login loop | Refresh, reutilizar sesión activa |
| Cotización no guarda | Mostrar una cotización ya existente |
| Proyecto no guarda | Mostrar un proyecto ya existente |
| Dashboard vacío | "Se cargará con los proyectos reales" |
| PDF no abre | "Storage configurado en servidor privado" |
| Internet lento | Preparar screenshots en PDF como backup |
