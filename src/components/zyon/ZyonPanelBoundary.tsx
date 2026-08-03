"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Sparkles, X } from "lucide-react";

type Props = {
  children: ReactNode;
  resetKey: string;
  onClose?: () => void;
  variant?: "panel" | "workspace";
};

type State = {
  failed: boolean;
};

export default class ZyonPanelBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ZYON render failed", error, info);
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

    const workspace = this.props.variant === "workspace";

    return (
      <aside className={`relative z-40 flex h-full w-full flex-col bg-panel/98 backdrop-blur-xl ${workspace ? "" : "border-l border-border"}`}>
        <div className="flex min-h-14 items-center gap-3 border-b border-border px-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground">ZYON</span>
          {this.props.onClose ? (
            <button
              type="button"
              onClick={this.props.onClose}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
              aria-label="Close ZYON"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-[300px]">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-warning/20 bg-warning/[0.06] text-warning">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="mt-4 text-[11px] font-semibold text-foreground">ZYON stayed contained</div>
            <p className="mt-2 text-[9px] leading-4 text-muted">
              {workspace
                ? "The workspace was isolated before it could interrupt the rest of Kwant Desk."
                : "The conversation panel was isolated before it could interrupt your chart."}
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-2 text-[8px] font-semibold text-primary transition-colors hover:bg-primary/[0.1]"
            >
              <RefreshCw className="h-3 w-3" />
              Retry ZYON
            </button>
          </div>
        </div>
      </aside>
    );
  }
}
