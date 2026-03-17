import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || 'unknown', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__inner">
            <span className="error-boundary__icon">&#9888;</span>
            <h3 className="error-boundary__title">Erro ao renderizar {this.props.name || 'este módulo'}</h3>
            <p className="error-boundary__msg">{this.state.error?.message || 'Erro desconhecido'}</p>
            <button
              className="error-boundary__btn"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
