import { useEffect } from 'react'
import { Sidebar } from './Sidebar'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div className="absolute inset-y-0 left-0 w-56 flex flex-col">
        <Sidebar collapsed={false} onToggle={() => {}} onClose={onClose} />
      </div>
    </div>
  )
}
