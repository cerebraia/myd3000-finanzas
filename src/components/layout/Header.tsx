import { Menu, Search, Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center gap-4">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 p-1 -ml-1 rounded-md"
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>

      {/* Title */}
      <h1 className="text-base font-semibold text-gray-800 lg:text-lg">
        {title}
      </h1>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <button
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors min-w-[180px]"
          aria-label="Buscar"
        >
          <Search size={15} />
          <span>Buscar...</span>
          <kbd className="ml-auto text-xs text-gray-300 font-sans">⌘K</kbd>
        </button>

        <button
          className="sm:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Buscar"
        >
          <Search size={18} />
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Notificaciones"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        {/* Company badge */}
        <div className="hidden md:flex items-center gap-1.5 pl-3 ml-1 border-l border-gray-200">
          <div className="w-6 h-6 rounded bg-brand-700 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">M</span>
          </div>
          <span className="text-xs font-medium text-gray-600">MYD3000</span>
        </div>
      </div>
    </header>
  )
}
