import { Component, type ErrorInfo, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Falha fatal da interface", error, info); }
  render() {
    if (this.state.failed) return <div className="fatal-error"><strong>O aplicativo encontrou um erro.</strong><p>Seus dados salvos continuam preservados.</p><button className="primary-button" onClick={() => window.location.reload()}>Reabrir aplicativo</button></div>;
    return this.props.children;
  }
}
