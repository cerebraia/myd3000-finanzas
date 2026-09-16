import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Error desconocido',
    }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-8 py-10 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-[var(--myd-text)]">Ha ocurrido un error</h2>
            <p className="text-sm text-[var(--myd-muted)]">
              La aplicación encontró un problema inesperado. Puedes intentar recargar o volver al inicio.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
                Reintentar
              </button>
              <a href="/dashboard"
                className="px-4 py-2 text-white rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
