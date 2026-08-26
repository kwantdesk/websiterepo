"use client";

import { useEffect, useRef, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import { BookmarkPlus, Download, Trash2, Upload } from "lucide-react";
import {
  INDICATOR_TEMPLATES_EVENT,
  deleteIndicatorTemplate,
  exportIndicatorTemplate,
  importIndicatorTemplate,
  loadIndicatorTemplates,
  saveIndicatorTemplate,
  type IndicatorTemplate,
} from "@/lib/indicatorTemplates";

/**
 * Save, open and import settings templates — the same bar on every indicator.
 *
 * Only the footprint had this, so ten minutes spent colouring a MACD could not
 * be kept, reused on another chart, or moved to another machine.
 *
 * Applying a template MERGES over the current settings rather than replacing
 * them. A template saved before a study gained a setting would otherwise wipe
 * that setting back to undefined, and the indicator would come back subtly
 * different from the one that was saved.
 */
/** The shape the indicator settings store actually holds. */
type IndicatorSettings = Record<string, string | number | boolean>;

type Props = {
  indicatorId: string;
  settings: IndicatorSettings;
  onApply: (settings: IndicatorSettings) => void;
};

/**
 * A stored template narrowed back to what the settings store accepts.
 *
 * Templates are read from browser storage, so a hand-edited file can carry an
 * object or an array where a scalar belongs. Those are dropped rather than
 * written into an indicator that will not understand them.
 */
const asIndicatorSettings = (value: Record<string, unknown>): IndicatorSettings => {
  const out: IndicatorSettings = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      out[key] = entry;
    }
  }
  return out;
};

export default function IndicatorTemplateBar({ indicatorId, settings, onApply }: Props) {
  const [templates, setTemplates] = useState<IndicatorTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setTemplates(loadIndicatorTemplates(indicatorId));
    refresh();
    window.addEventListener(INDICATOR_TEMPLATES_EVENT, refresh);
    return () => window.removeEventListener(INDICATOR_TEMPLATES_EVENT, refresh);
  }, [indicatorId]);

  const report = (tone: "ok" | "error", text: string) => {
    setStatus({ tone, text });
    window.setTimeout(() => setStatus((current) => (current?.text === text ? null : current)), 3_000);
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) return;
    onApply({ ...settings, ...asIndicatorSettings(template.settings) });
    report("ok", `Opened ${template.name}`);
  };

  const save = () => {
    const result = saveIndicatorTemplate(indicatorId, name, settings);
    if (!result.ok) {
      report("error", result.error);
      return;
    }
    setTemplates(result.templates);
    setSelectedId(result.template.id);
    setName("");
    report("ok", `Saved ${result.template.name}`);
  };

  const exportSelected = () => {
    const template = templates.find((entry) => entry.id === selectedId);
    if (!template) {
      report("error", "Choose a template to export.");
      return;
    }
    // A data: URL download is blocked in some embedded viewers, so the text is
    // put on the clipboard instead, which works everywhere the desk runs.
    const text = exportIndicatorTemplate(template);
    void navigator.clipboard?.writeText(text)
      .then(() => report("ok", `${template.name} copied as JSON`))
      .catch(() => report("error", "Could not copy the template."));
  };

  const importFile = (file: File | null | undefined) => {
    if (!file) return;
    void file.text().then((raw) => {
      const result = importIndicatorTemplate(indicatorId, raw);
      if (!result.ok) {
        report("error", result.error);
        return;
      }
      onApply({ ...settings, ...asIndicatorSettings(result.settings) });
      setName(result.name);
      report("ok", `Imported ${result.name}`);
    }).catch(() => report("error", "That file could not be read."));
  };

  const remove = () => {
    const template = templates.find((entry) => entry.id === selectedId);
    if (!template) {
      report("error", "Choose a template to delete.");
      return;
    }
    setTemplates(deleteIndicatorTemplate(indicatorId, template.id));
    setSelectedId("");
    report("ok", `Deleted ${template.name}`);
  };

  const chip = "flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-primary/35 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface/30 p-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Templates</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <KwantSelect
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            if (event.target.value) applyTemplate(event.target.value);
          }}
          aria-label="Saved templates"
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-[10px] text-foreground outline-none focus:border-primary/40"
        >
          <option value="">{templates.length ? "Open a template…" : "No saved templates"}</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </KwantSelect>
        <button type="button" onClick={exportSelected} disabled={!selectedId} className={chip} title="Copy this template as JSON">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={chip} title="Load a template from a file">
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <button type="button" onClick={remove} disabled={!selectedId} className={chip} title="Delete this template">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") save(); }}
          placeholder="Template name"
          aria-label="Template name"
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-[10px] text-foreground outline-none focus:border-primary/40"
        />
        <button type="button" onClick={save} disabled={!name.trim()} className={chip}>
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save template
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.txt"
        className="hidden"
        onChange={(event) => {
          importFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {status ? (
        <div className={`text-[8px] ${status.tone === "ok" ? "text-primary" : "text-danger"}`} role="status">
          {status.text}
        </div>
      ) : null}
    </div>
  );
}
