export interface PendingTask {
  id: string
  title: string
  subtitle: string
  amount?: number
  dueLabel: string
  overdue: boolean
  action: string
}

export interface Metric {
  id: string
  label: string
  value: string
  subtitle: string
  trend?: { value: string; positive: boolean }
}

export interface ActiveProject {
  id: string
  name: string
  client: string
  stage: 'Diseño' | 'Producción' | 'Instalación'
  monto: number
  cobrado: number
  pendiente: number
  margen: number
}

export interface UpcomingPayment {
  id: string
  date: string
  description: string
  amount: number
  type: 'cobrar' | 'pagar'
}

export interface ActivityItem {
  id: string
  group: string
  time: string
  description: string
  detail?: string
}

export interface CashFlow {
  ingresos: number
  egresos: number
  flujoNeto: number
  periodo: string
}

export const pendingTasks: PendingTask[] = [
  {
    id: '1',
    title: 'Enviar cotización — Residencia San Román',
    subtitle: 'Cliente: Pedro Rodríguez · Amoblamiento completo',
    amount: 28500,
    dueLabel: 'Vence hoy',
    overdue: false,
    action: 'Ver cotización',
  },
  {
    id: '2',
    title: 'Cobro pendiente — Proyecto La Lagunita',
    subtitle: 'Factura #MYD-2026-048 · 2da cuota',
    amount: 12000,
    dueLabel: 'Vence hoy',
    overdue: false,
    action: 'Ver proyecto',
  },
  {
    id: '3',
    title: 'Aprobar orden de compra — Proveedor MADEVAL',
    subtitle: 'Madera de pino · 200 tablones',
    amount: 4200,
    dueLabel: 'Vence mañana',
    overdue: false,
    action: 'Ver orden',
  },
  {
    id: '4',
    title: 'Firma de contrato — Oficina 3H',
    subtitle: 'Cliente: Grupo 3H C.A. · Mobiliario ejecutivo',
    dueLabel: 'Vencido hace 2 días',
    overdue: true,
    action: 'Ver contrato',
  },
  {
    id: '5',
    title: 'Revisión de planos — Los Palos Grandes',
    subtitle: 'Arq. Morales · Revisión técnica pendiente',
    dueLabel: 'Esta semana',
    overdue: false,
    action: 'Ver proyecto',
  },
]

export const metrics: Metric[] = [
  {
    id: 'proyectos-activos',
    label: 'Proyectos activos',
    value: '7',
    subtitle: '3 en producción, 2 en instalación',
  },
  {
    id: 'cotizaciones-mes',
    label: 'Cotizaciones este mes',
    value: '14',
    subtitle: '6 aprobadas · 4 en revisión',
    trend: { value: '+23% vs mes anterior', positive: true },
  },
  {
    id: 'ingresos-mes',
    label: 'Ingresos del mes',
    value: '$84,200',
    subtitle: 'Meta: $100,000',
    trend: { value: '84% de la meta', positive: false },
  },
  {
    id: 'por-cobrar',
    label: 'Por cobrar',
    value: '$38,500',
    subtitle: '5 facturas pendientes',
  },
  {
    id: 'nuevos-clientes',
    label: 'Nuevos clientes',
    value: '3',
    subtitle: 'Últimos 30 días',
    trend: { value: '+1 vs mes anterior', positive: true },
  },
  {
    id: 'margen-promedio',
    label: 'Margen promedio',
    value: '34%',
    subtitle: 'Sobre proyectos activos',
    trend: { value: '+2pp vs trimestre anterior', positive: true },
  },
]

export const activeProjects: ActiveProject[] = [
  {
    id: 'p1',
    name: 'Residencia San Román',
    client: 'Pedro Rodríguez',
    stage: 'Producción',
    monto: 85000,
    cobrado: 42500,
    pendiente: 42500,
    margen: 36,
  },
  {
    id: 'p2',
    name: 'Proyecto La Lagunita',
    client: 'María Fernández',
    stage: 'Instalación',
    monto: 48000,
    cobrado: 36000,
    pendiente: 12000,
    margen: 31,
  },
  {
    id: 'p3',
    name: 'Oficina 3H',
    client: 'Grupo 3H C.A.',
    stage: 'Diseño',
    monto: 62000,
    cobrado: 18600,
    pendiente: 43400,
    margen: 38,
  },
  {
    id: 'p4',
    name: 'Los Palos Grandes',
    client: 'Carlos Lameda',
    stage: 'Producción',
    monto: 34500,
    cobrado: 17250,
    pendiente: 17250,
    margen: 29,
  },
]

export const upcomingPayments: UpcomingPayment[] = [
  {
    id: 'up1',
    date: '2026-09-02',
    description: '2da cuota — La Lagunita',
    amount: 12000,
    type: 'cobrar',
  },
  {
    id: 'up2',
    date: '2026-09-05',
    description: 'Proveedor MADEVAL — Orden #OC-88',
    amount: 4200,
    type: 'pagar',
  },
  {
    id: 'up3',
    date: '2026-09-07',
    description: 'Anticipo — Residencia San Román (3ra cuota)',
    amount: 21250,
    type: 'cobrar',
  },
  {
    id: 'up4',
    date: '2026-09-10',
    description: 'Alquiler taller — Septiembre',
    amount: 2800,
    type: 'pagar',
  },
  {
    id: 'up5',
    date: '2026-09-12',
    description: '1ra cuota — Oficina 3H',
    amount: 18600,
    type: 'cobrar',
  },
]

export const recentActivity: ActivityItem[] = [
  {
    id: 'a1',
    group: 'HOY',
    time: '10:32',
    description: 'Cotización enviada',
    detail: 'Residencia San Román — $85,000',
  },
  {
    id: 'a2',
    group: 'HOY',
    time: '09:15',
    description: 'Nuevo cliente registrado',
    detail: 'Carlos Lameda — Los Palos Grandes',
  },
  {
    id: 'a3',
    group: 'HOY',
    time: '08:44',
    description: 'Pago recibido',
    detail: 'La Lagunita — $12,000',
  },
  {
    id: 'a4',
    group: 'AYER',
    time: '17:20',
    description: 'Contrato generado',
    detail: 'Oficina 3H — #CONT-2026-031',
  },
  {
    id: 'a5',
    group: 'AYER',
    time: '15:05',
    description: 'Etapa actualizada',
    detail: 'La Lagunita → Instalación',
  },
  {
    id: 'a6',
    group: 'AYER',
    time: '11:30',
    description: 'Orden de compra aprobada',
    detail: 'MADEVAL — $4,200',
  },
]

export const cashFlow: CashFlow = {
  ingresos: 84200,
  egresos: 31450,
  flujoNeto: 52750,
  periodo: 'Septiembre 2026',
}
