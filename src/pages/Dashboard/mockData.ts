import type { LucideIcon } from 'lucide-react'

export interface PendingTask {
  id: string
  variant: 'cobro' | 'cotizacion' | 'pago' | 'contrato' | 'documento'
  title: string
  detail: string
  meta: string
  badge: string
  badgeColor: 'orange' | 'blue' | 'red'
  actionLabel: string
  iconName: string
}

export interface ActiveProject {
  id: string
  proyecto: string
  cliente: string
  etapa: string
  monto: number
  cobrado: number
  pendiente: number
  margen: number
}

export interface UpcomingPayment {
  id: string
  label: string
  date: string
  amount: string
  urgent: boolean
}

export interface ActivityEntry {
  id: string
  text: string
  time: string
  iconName: string
  iconColor: string
}

export const pendingTasks: PendingTask[] = [
  {
    id: '1',
    variant: 'cobro',
    title: 'Cobro pendiente',
    detail: 'Proyecto Apartamento San Román · Segundo abono · $3.500',
    meta: 'Vence hoy',
    badge: 'Vence hoy',
    badgeColor: 'orange',
    actionLabel: 'Registrar pago',
    iconName: 'DollarSign',
  },
  {
    id: '2',
    variant: 'cotizacion',
    title: 'Cotización COT-2026-0041',
    detail: 'María González · Esperando aprobación',
    meta: '4 días en espera',
    badge: 'En espera',
    badgeColor: 'blue',
    actionLabel: 'Ver cotización',
    iconName: 'FileText',
  },
  {
    id: '3',
    variant: 'pago',
    title: 'Pago a realizar',
    detail: 'Arquitecto · Proyecto Los Palos Grandes · $450',
    meta: 'Vence hoy',
    badge: 'Vence hoy',
    badgeColor: 'orange',
    actionLabel: 'Registrar pago',
    iconName: 'CreditCard',
  },
  {
    id: '4',
    variant: 'contrato',
    title: 'Contrato #MYD-2026-0028',
    detail: 'Pendiente por firma',
    meta: 'Sin actividad hace 3 días',
    badge: 'Pendiente firma',
    badgeColor: 'red',
    actionLabel: 'Revisar',
    iconName: 'ScrollText',
  },
  {
    id: '5',
    variant: 'documento',
    title: 'Facturas por registrar',
    detail: '3 documentos pendientes de carga',
    meta: '',
    badge: '3 pendientes',
    badgeColor: 'blue',
    actionLabel: 'Ver documentos',
    iconName: 'Archive',
  },
]

export const activeProjects: ActiveProject[] = [
  {
    id: '1',
    proyecto: 'Apartamento San Román',
    cliente: 'Cocina + Bar',
    etapa: 'Producción',
    monto: 18500,
    cobrado: 12000,
    pendiente: 6500,
    margen: 22,
  },
  {
    id: '2',
    proyecto: 'Residencia La Lagunita',
    cliente: 'Closets',
    etapa: 'Instalación',
    monto: 9800,
    cobrado: 7840,
    pendiente: 1960,
    margen: 31,
  },
  {
    id: '3',
    proyecto: 'Oficina 3H',
    cliente: 'Mobiliario',
    etapa: 'Producción',
    monto: 7250,
    cobrado: 3625,
    pendiente: 3625,
    margen: 26,
  },
  {
    id: '4',
    proyecto: 'Aparta. Los Palos Grandes',
    cliente: 'Vestier',
    etapa: 'Diseño',
    monto: 6300,
    cobrado: 1890,
    pendiente: 4410,
    margen: 18,
  },
]

export const upcomingPayments: UpcomingPayment[] = [
  { id: '1', label: 'Internet', date: 'SEP 02', amount: '$65', urgent: false },
  { id: '2', label: 'Carpintero · Proyecto San Román', date: 'SEP 05', amount: '$1.200', urgent: false },
  { id: '3', label: 'Arquitectos', date: 'SEP 15', amount: '$450', urgent: false },
  { id: '4', label: 'IVA', date: 'SEP 15', amount: '$320', urgent: false },
  { id: '5', label: 'SENIAT', date: 'SEP 15', amount: '$180', urgent: false },
]

export const recentActivity: ActivityEntry[] = [
  {
    id: '1',
    text: 'Se registró pago de $2.500 del cliente San Román.',
    time: 'Hoy, 10:42 am',
    iconName: 'DollarSign',
    iconColor: 'text-emerald-600',
  },
  {
    id: '2',
    text: 'Se agregó factura de proveedor.',
    time: 'Hoy, 09:15 am',
    iconName: 'Archive',
    iconColor: 'text-blue-600',
  },
  {
    id: '3',
    text: 'Contrato #MYD-2026-0021 firmado.',
    time: 'Ayer, 04:30 pm',
    iconName: 'ScrollText',
    iconColor: 'text-emerald-600',
  },
  {
    id: '4',
    text: 'Cotización aprobada por el cliente.',
    time: 'Ayer, 02:12 pm',
    iconName: 'CheckCircle',
    iconColor: 'text-emerald-600',
  },
  {
    id: '5',
    text: 'Cotización COT-2026-0035 enviada.',
    time: '30 ago, 11:00 am',
    iconName: 'Send',
    iconColor: 'text-blue-600',
  },
]

export type { LucideIcon }
