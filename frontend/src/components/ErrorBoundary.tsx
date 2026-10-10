import { Component, type ReactNode } from "react";
import { Result, Button } from "antd";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Result status="error" title="页面加载失败" subTitle={String(this.state.error?.message || this.state.error)}
          extra={<Button type="primary" onClick={() => window.location.reload()}>刷新页面</Button>} />
      );
    }
    return this.props.children;
  }
}
