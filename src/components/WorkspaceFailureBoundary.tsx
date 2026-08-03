"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: ReactNode;
  resetKey: string;
  label?: string;
  variant?: "content" | "shell";
};

type State = {
  failed: boolean;
};

export default class WorkspaceFailureBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Kwant Desk workspace render failed", {
      workspace: this.props.label,
      error,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const shell = this.props.variant === "shell";
    return (
      <div className={`flex min-h-0 w-full flex-1 items-center justify-center bg-panel px-6 text-center ${shell ? "h-screen" : "h-full"}`}>
        <div className="max-w-sm rounded-3xl border border-border bg-background/45 px-7 py-8 shadow-2xl backdrop-blur-xl">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-warning/20 bg-warning/[0.06] text-warning">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <h2 className="mt-4 text-[13px] font-semibold text-foreground">
            {this.props.label ? `${this.props.label} paused safely` : "Workspace paused safely"}
          </h2>
          <p className="mt-2 text-[10px] leading-5 text-muted">
            This section was contained before it could interrupt the rest of Kwant Desk.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/[0.12]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry section
          </button>
        </div>
      </div>
    );
  }
}
