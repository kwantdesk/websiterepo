"use client";

import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  isDeploymentAssetFailure,
  recordClientRenderFailure,
  reloadForDeploymentAssetFailureOnce,
} from "@/lib/clientFailureRecovery";

type Props = {
  children: ReactNode;
  resetKey: string;
  label?: string;
  variant?: "content" | "shell";
};

type State = {
  failed: boolean;
  recoveryKey: number;
  attempts: number;
  errorCode: string;
};

export default class WorkspaceFailureBoundary extends Component<Props, State> {
  state: State = { failed: false, recoveryKey: 0, attempts: 0, errorCode: "" };
  private recoveryTimer: number | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const failure = recordClientRenderFailure(
      this.props.label ?? "Workspace",
      error,
      info.componentStack ?? "",
    );
    this.setState({ errorCode: failure.code });
    console.error("Kwant Desk workspace render failed", {
      workspace: this.props.label,
      error,
      componentStack: info.componentStack,
    });
    if (isDeploymentAssetFailure(error) && reloadForDeploymentAssetFailureOnce()) return;
    if (this.state.attempts < 2) {
      this.recoveryTimer = window.setTimeout(() => {
        this.recoveryTimer = null;
        this.setState((current) => ({
          failed: false,
          recoveryKey: current.recoveryKey + 1,
          attempts: current.attempts + 1,
          errorCode: "",
        }));
      }, this.state.attempts === 0 ? 80 : 300);
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState((current) => ({
        failed: false,
        recoveryKey: current.recoveryKey + 1,
        attempts: 0,
        errorCode: "",
      }));
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimer !== null) window.clearTimeout(this.recoveryTimer);
  }

  private retry = () => {
    this.setState((current) => ({
      failed: false,
      recoveryKey: current.recoveryKey + 1,
      attempts: 0,
      errorCode: "",
    }));
  };

  render() {
    if (!this.state.failed) {
      return <Fragment key={this.state.recoveryKey}>{this.props.children}</Fragment>;
    }

    if (this.state.attempts < 2) {
      return (
        <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-panel">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      );
    }

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
            The section could not recover after two clean remounts.
          </p>
          {this.state.errorCode ? <p className="mt-2 font-mono text-[9px] text-muted">{this.state.errorCode}</p> : null}
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
