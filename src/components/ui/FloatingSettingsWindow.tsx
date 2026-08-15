"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X } from "lucide-react";

type FloatingSettingsWindowProps = {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  contentClassName?: string;
  zIndexClassName?: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

/**
 * A non-modal settings surface for live charts. Only the window itself captures
 * pointer input, leaving the chart underneath available for pan/zoom while the
 * user tunes an indicator. The title bar keeps the window movable and clamped
 * to the current viewport.
 */
export default function FloatingSettingsWindow({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClassName = "w-[min(540px,calc(100vw-24px))]",
  contentClassName = "space-y-4 p-4",
  zIndexClassName = "z-[2800]",
}: FloatingSettingsWindowProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const onCloseRef = useRef(onClose);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setOffset({ x: 0, y: 0 });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const clampOffset = (x: number, y: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    const padding = 8;
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;
    return {
      x: Math.max(padding + halfWidth - window.innerWidth / 2, Math.min(x, window.innerWidth / 2 - padding - halfWidth)),
      y: Math.max(padding + halfHeight - window.innerHeight / 2, Math.min(y, window.innerHeight / 2 - padding - halfHeight)),
    };
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, [role='button']")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(clampOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
    ));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={`pointer-events-none fixed inset-0 ${zIndexClassName}`} data-floating-settings-layer>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={typeof title === "string" ? title : "Indicator settings"}
        className={`pointer-events-auto absolute left-1/2 top-1/2 flex max-h-[calc(100vh-24px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-border bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.68)] ${widthClassName}`}
        style={{ marginLeft: offset.x, marginTop: offset.y }}
      >
        <div
          className="flex h-11 shrink-0 touch-none select-none items-center gap-2 border-b border-border px-3 cursor-move active:cursor-grabbing"
          title="Drag settings window"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">{title}</div>
            {subtitle ? <div className="mt-0.5 truncate text-[8px] text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-border text-muted hover:border-primary/40 hover:text-foreground"
            aria-label="Close settings"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${contentClassName}`}>{children}</div>
        {footer ? <div className="shrink-0 border-t border-border p-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
