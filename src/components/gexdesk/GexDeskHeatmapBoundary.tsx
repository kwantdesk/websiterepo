"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

export default class GexDeskHeatmapBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Gexdesk heatmap render failed", error, info);
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="flex min-h-[650px] items-center justify-center rounded-2xl border border-border bg-panel p-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-warning/20 bg-warning/[0.06] text-warning">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="mt-4 text-[10px] font-semibold">Heatmap recovered safely</div>
          <p className="mt-2 text-[7px] leading-5 text-muted">
            A malformed live update was isolated before it could close the Gexdesk page.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-2 text-[7px] font-semibold text-primary transition-colors hover:bg-primary/[0.1]"
          >
            <RefreshCw className="h-3 w-3" />
            Reload heatmap
          </button>
        </div>
      </section>
    );
  }
}
