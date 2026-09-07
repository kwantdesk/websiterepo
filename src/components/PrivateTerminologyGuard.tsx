"use client";

import { useLayoutEffect } from "react";
import { publicFacingTerminology } from "@/lib/privateTerminology";

const VISIBLE_ATTRIBUTES = ["aria-label", "alt", "placeholder", "title"] as const;

/**
 * Last-line privacy boundary for user-facing copy. Internal provider names are
 * intentionally retained in transport contracts, but must never leak through
 * rendered status/error payloads or operator tooling.
 */
export default function PrivateTerminologyGuard() {
  useLayoutEffect(() => {
    const observers: MutationObserver[] = [];
    const observedRoots = new WeakSet<Node>();
    const iframeListeners = new Map<HTMLIFrameElement, () => void>();

    const scrubTree = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const current = node.nodeValue ?? "";
        const next = publicFacingTerminology(current);
        if (next !== current) node.nodeValue = next;
        return;
      }
      if (!(node instanceof Element)) return;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName)) return;

      for (const attribute of VISIBLE_ATTRIBUTES) {
        const current = node.getAttribute(attribute);
        if (current == null) continue;
        const next = publicFacingTerminology(current);
        if (next !== current) node.setAttribute(attribute, next);
      }

      if (node instanceof HTMLIFrameElement && !iframeListeners.has(node)) {
        const attach = () => {
          try {
            if (node.contentDocument?.documentElement) observe(node.contentDocument.documentElement);
          } catch {
            // Cross-origin frames cannot be inspected and are outside our UI.
          }
        };
        iframeListeners.set(node, attach);
        node.addEventListener("load", attach);
        attach();
      }

      for (const child of node.childNodes) scrubTree(child);
    };

    function observe(root: Node) {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
      scrubTree(root);
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData") scrubTree(record.target);
          if (record.type === "attributes") scrubTree(record.target);
          for (const added of record.addedNodes) scrubTree(added);
        }
      });
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...VISIBLE_ATTRIBUTES],
      });
      observers.push(observer);
    }

    observe(document.body);
    document.documentElement.classList.remove("kwant-private-copy-pending");
    return () => {
      for (const observer of observers) observer.disconnect();
      for (const [iframe, listener] of iframeListeners) iframe.removeEventListener("load", listener);
    };
  }, []);

  return null;
}
