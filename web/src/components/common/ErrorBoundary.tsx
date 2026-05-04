import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Console render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="screen-state error-state">
          <div className="route-error-card">
            <h1>控制台渲染失败</h1>
            <p>{this.state.error.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
