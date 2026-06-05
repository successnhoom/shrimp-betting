'use client'
import { Component, ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card text-center max-w-sm w-full">
            <div className="text-5xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-500 text-sm mb-4">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()}
              className="btn-primary w-full">
              รีโหลดหน้า
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
