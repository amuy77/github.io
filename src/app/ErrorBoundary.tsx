import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('LaRa crashed', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-5xl" aria-hidden>🥐</span>
        <h1 className="font-display text-xl font-bold">あらら、エラーが起きました</h1>
        <p className="max-w-sm text-sm text-muted">{this.state.error.message}</p>
        <button type="button" className="h-11 rounded-chip bg-green-600 px-5 font-bold text-white" onClick={() => location.reload()}>読み込み直す</button>
      </div>
    )
  }
}
