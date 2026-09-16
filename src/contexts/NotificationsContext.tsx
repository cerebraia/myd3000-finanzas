import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/services/notifications'
import { notificationsKeys } from '@/lib/queryKeys'
import type { Notification } from '@/types'

interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  handleMarkRead: (id: string) => void
  handleMarkAllRead: () => void
  isLoading: boolean
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: notificationsKeys.all,
    queryFn: () => getNotifications(20),
    refetchInterval: 60_000, // poll every 60s
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: notificationsKeys.unreadCount,
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
  })

  const readMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all })
      qc.invalidateQueries({ queryKey: notificationsKeys.unreadCount })
    },
  })

  const readAllMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all })
      qc.invalidateQueries({ queryKey: notificationsKeys.unreadCount })
    },
  })

  const open     = useCallback(() => setIsOpen(true), [])
  const close    = useCallback(() => setIsOpen(false), [])
  const toggle   = useCallback(() => setIsOpen(v => !v), [])

  const handleMarkRead    = useCallback((id: string) => readMutation.mutate(id), [readMutation])
  const handleMarkAllRead = useCallback(() => readAllMutation.mutate(), [readAllMutation])

  return (
    <NotificationsContext.Provider value={{
      notifications, unreadCount, isOpen,
      open, close, toggle,
      handleMarkRead, handleMarkAllRead, isLoading,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
