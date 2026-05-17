import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Space } from '@douyinfe/semi-ui';

type ErrorBoundaryState = {
  error: Error | null;
  lastPathname: string | null;
};

export default class ErrorBoundary extends Component<{ children: ReactNode; pathname?: string }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    lastPathname: this.props.pathname ?? null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: { pathname?: string }, state: ErrorBoundaryState) {
    if (props.pathname !== state.lastPathname) {
      return {
        error: null,
        lastPathname: props.pathname ?? null,
      };
    }

    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Console render error', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="screen-state error-state">
          <div className="route-error-card">
            <h1>控制台渲染失败</h1>
            <p>{this.state.error.message}</p>
            <Space wrap>
              <Button theme="solid" type="primary" onClick={this.reset}>重试</Button>
              <Button onClick={() => window.location.reload()}>刷新页面</Button>
            </Space>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
