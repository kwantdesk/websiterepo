"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { failed: boolean }

export default class PrecisionToolsBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    window.dispatchEvent(new CustomEvent("kwantdesk:precision-tools-error", {
      detail: { message: error.message, componentStack: info.componentStack },
    }));
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="pointer-events-auto absolute left-[108px] top-[74px] z-[74] border border-[#6d3a49] bg-[#210f16]/95 px-3 py-2 font-mono text-[9px] text-[#ff8195]">
        Precision Tools paused. The chart and legacy tools remain available.
      </div>
    );
  }
}
