"use client";
import Panel from "@/components/support/SupportDeskPanel";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { LifeBuoy } from "lucide-react";
export default function SupportAssistantWidget() {
    const path = usePathname(), [open, setOpen] = useState(false), trigger = useRef<HTMLButtonElement>(null);
    function close() { setOpen(false); trigger.current?.focus(); }
    useEffect(() => { if (!open)
        return; const key = (e: KeyboardEvent) => { if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
    } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [open]);
    useEffect(() => { if (path.startsWith("/login"))
        setOpen(false); }, [path]);
    if (path === "/support")
        return null;
    return <><button ref={trigger} type="button" onClick={() => setOpen(v => !v)} aria-label={open ? "Minimize support" : "Help and support"} aria-expanded={open} className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] right-[max(12px,env(safe-area-inset-right))] z-[90] flex h-10 items-center gap-2 rounded-full border border-border bg-panel px-3 text-[11px] font-semibold text-foreground shadow-lg hover:bg-surface"><LifeBuoy size={16}/><span>Help</span></button>{open && typeof document !== "undefined" && createPortal(<div role="dialog" aria-label="Help and support" className="fixed bottom-[max(60px,calc(env(safe-area-inset-bottom)+56px))] right-3 z-[11000]"><Panel onClose={close}/></div>, document.body)}</>;
}
