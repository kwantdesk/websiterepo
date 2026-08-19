"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type KwantSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size"> & {
  menuLabel?: string;
};

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

function textFromNode(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (!isValidElement<{ children?: ReactNode }>(child)) return "";
      return textFromNode(child.props.children);
    })
    .join("")
    .trim();
}

function optionsFromChildren(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{
      children?: ReactNode;
      value?: string | number | readonly string[];
      disabled?: boolean;
    }>(child)) return [];
    if (child.type === Fragment) return optionsFromChildren(child.props.children);
    if (child.type !== "option") return [];
    const label = textFromNode(child.props.children);
    const rawValue = child.props.value ?? label;
    const optionValue = Array.isArray(rawValue) ? rawValue[0] ?? "" : rawValue;
    return [{
      value: String(optionValue),
      label,
      disabled: Boolean(child.props.disabled),
    }];
  });
}

function normalizedValue(value: string | readonly string[] | number | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return value === undefined ? "" : String(value);
}

/** True when the target sits inside a KwantSelect dropdown menu. The menu is
 * portaled to document.body, so host dialogs with outside-pointer close
 * handlers must treat it as their own content. */
export function isInsideKwantSelectMenu(target: EventTarget | Node | null): boolean {
  return target instanceof Element ? Boolean(target.closest("[data-kwant-select-menu]")) : false;
}

export default function KwantSelect({
  children,
  className = "",
  defaultValue,
  disabled = false,
  id,
  menuLabel = "Select option",
  name,
  onBlur,
  onChange,
  onFocus,
  required,
  style,
  tabIndex,
  title,
  value,
  ...ariaProps
}: KwantSelectProps) {
  const options = useMemo(() => optionsFromChildren(children), [children]);
  const controlled = value !== undefined;
  const defaultSelectedValue = normalizedValue(defaultValue);
  const [internalValue, setInternalValue] = useState(
    defaultSelectedValue || options.find((option) => !option.disabled)?.value || "",
  );
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedValue = controlled ? normalizedValue(value) : internalValue;
  const selectedOption =
    options.find((option) => option.value === selectedValue)
    ?? options.find((option) => !option.disabled)
    ?? null;

  useEffect(() => {
    if (controlled || !options.length) return;
    if (options.some((option) => option.value === internalValue && !option.disabled)) return;
    setInternalValue(defaultSelectedValue || options.find((option) => !option.disabled)?.value || "");
  }, [controlled, defaultSelectedValue, internalValue, options]);

  const closeMenu = () => setOpen(false);

  const positionAndOpenMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || disabled) return;
    const longestLabel = options.reduce((longest, option) => Math.max(longest, option.label.length), 0);
    const width = Math.min(
      Math.max(rect.width, 190, Math.min(320, longestLabel * 7 + 48)),
      Math.max(190, window.innerWidth - 16),
    );
    const estimatedHeight = Math.min(324, 42 + options.length * 39);
    const below = rect.bottom + 7;
    const top = below + estimatedHeight <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - estimatedHeight - 7);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top,
      width,
    });
    setOpen(true);
  };

  const choose = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    const eventTarget = { value: nextValue, name } as EventTarget & HTMLSelectElement;
    onChange?.({
      target: eventTarget,
      currentTarget: eventTarget,
    } as ChangeEvent<HTMLSelectElement>);
    closeMenu();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    };
    const closeOnViewportChange = () => closeMenu();
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        tabIndex={tabIndex}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-label={ariaProps["aria-label"]}
        aria-labelledby={ariaProps["aria-labelledby"]}
        aria-describedby={ariaProps["aria-describedby"]}
        onBlur={onBlur as unknown as SelectHTMLAttributes<HTMLButtonElement>["onBlur"]}
        onFocus={onFocus as unknown as SelectHTMLAttributes<HTMLButtonElement>["onFocus"]}
        onClick={() => {
          if (open) closeMenu();
          else positionAndOpenMenu();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const enabledOptions = options.filter((option) => !option.disabled);
          if (!enabledOptions.length) return;
          const currentIndex = enabledOptions.findIndex((option) => option.value === selectedValue);
          const direction = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = currentIndex < 0
            ? 0
            : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
          choose(enabledOptions[nextIndex].value);
        }}
        className={`group inline-flex items-center justify-between gap-2 text-left outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${
          open
            ? "border-primary/40 bg-primary/[0.08] text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
            : "hover:border-primary/25 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/10"
        } ${className}`}
        style={style}
      >
        <span className="min-w-0 flex-1 truncate">{selectedOption?.label || selectedValue || "Select"}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-primary" : "group-hover:text-foreground"}`} />
      </button>

      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}

      {open && position && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            data-kwant-select-menu
            aria-label={ariaProps["aria-label"] ?? menuLabel}
            className="fixed z-[12000] overflow-hidden rounded-2xl border border-border bg-panel/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: position.width }}
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted">
              <span>{menuLabel}</span>
              <span>{options.length}</span>
            </div>
            <div className="max-h-[274px] space-y-0.5 overflow-y-auto">
              {options.map((option) => {
                const active = option.value === selectedValue;
                return (
                  <button
                    key={`${option.value}:${option.label}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => choose(option.value)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-surface"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                    {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
