export type StrategyBuilderAttachmentKind = "csv" | "json" | "text" | "markdown" | "spreadsheet_unsupported" | "unknown";

export type StrategyBuilderAttachmentProfile = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: StrategyBuilderAttachmentKind;
  uploadedAt: string;
  summary: string;
  columns?: string[];
  rowCount?: number;
  sampleRows?: Record<string, string>[];
  issues?: string[];
  textPreview?: string;
};

const MAX_TEXT_PREVIEW = 4000;
const MAX_SAMPLE_ROWS = 5;

function extensionFor(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function detectKind(file: File): StrategyBuilderAttachmentKind {
  const extension = extensionFor(file.name);
  if (extension === "csv") return "csv";
  if (extension === "json") return "json";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "txt" || file.type.startsWith("text/")) return "text";
  if (extension === "xlsx" || extension === "xls") return "spreadsheet_unsupported";
  return "unknown";
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function profileCsv(file: File, text: string): Omit<StrategyBuilderAttachmentProfile, "id" | "name" | "type" | "size" | "uploadedAt"> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const issues: string[] = [];

  if (lines.length === 0) {
    return {
      kind: "csv",
      summary: "CSV file is empty.",
      columns: [],
      rowCount: 0,
      sampleRows: [],
      issues: ["No rows found."],
    };
  }

  const columns = splitCsvLine(lines[0]);
  const rows = lines.slice(1);
  if (columns.length === 0) issues.push("No header columns detected.");

  const sampleRows = rows.slice(0, MAX_SAMPLE_ROWS).map((line) => {
    const cells = splitCsvLine(line);
    return columns.reduce<Record<string, string>>((row, column, index) => {
      row[column || `column_${index + 1}`] = cells[index] ?? "";
      return row;
    }, {});
  });

  const lowerColumns = columns.map((column) => column.toLowerCase());
  const hasOhlcv = ["open", "high", "low", "close"].every((column) => lowerColumns.includes(column));
  const hasTradeLedger = lowerColumns.some((column) => ["entry", "entryprice", "entry_price"].includes(column)) &&
    lowerColumns.some((column) => ["exit", "exitprice", "exit_price"].includes(column));
  const detected = hasOhlcv ? "OHLCV market data" : hasTradeLedger ? "trade ledger" : "tabular trading data";

  return {
    kind: "csv",
    summary: `${detected}; ${rows.length} data rows; ${columns.length} columns.`,
    columns,
    rowCount: rows.length,
    sampleRows,
    issues,
  };
}

function profileJson(text: string): Omit<StrategyBuilderAttachmentProfile, "id" | "name" | "type" | "size" | "uploadedAt"> {
  try {
    const parsed = JSON.parse(text) as unknown;
    const isArray = Array.isArray(parsed);
    const rowCount = isArray ? parsed.length : typeof parsed === "object" && parsed !== null ? 1 : 0;
    const first = isArray ? parsed[0] : parsed;
    const columns = typeof first === "object" && first !== null ? Object.keys(first as Record<string, unknown>) : [];
    const sampleRows = isArray
      ? parsed.slice(0, MAX_SAMPLE_ROWS).filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).map((item) =>
          Object.fromEntries(Object.entries(item).map(([key, value]) => [key, String(value)]))
        )
      : [];

    return {
      kind: "json",
      summary: `JSON ${isArray ? "array" : "document"}; ${rowCount} top-level ${isArray ? "rows" : "object"}; ${columns.length} detected fields.`,
      columns,
      rowCount,
      sampleRows,
      textPreview: text.slice(0, MAX_TEXT_PREVIEW),
    };
  } catch (error) {
    return {
      kind: "json",
      summary: "JSON file could not be parsed.",
      issues: [(error as Error).message],
      textPreview: text.slice(0, MAX_TEXT_PREVIEW),
    };
  }
}

function profileText(kind: StrategyBuilderAttachmentKind, text: string): Omit<StrategyBuilderAttachmentProfile, "id" | "name" | "type" | "size" | "uploadedAt"> {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  return {
    kind,
    summary: `${kind === "markdown" ? "Markdown" : "Text"} note; ${wordCount} words; ${text.length} characters.`,
    textPreview: text.slice(0, MAX_TEXT_PREVIEW),
  };
}

export async function profileStrategyBuilderFile(file: File): Promise<StrategyBuilderAttachmentProfile> {
  const kind = detectKind(file);
  const base = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type || "unknown",
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };

  if (kind === "spreadsheet_unsupported") {
    return {
      ...base,
      kind,
      summary: "Excel spreadsheet detected. XLS/XLSX parsing is not enabled in this build yet; export this file as CSV for full AI analysis.",
      issues: ["Spreadsheet parser dependency is not installed yet."],
    };
  }

  if (kind === "unknown") {
    return {
      ...base,
      kind,
      summary: "Unsupported attachment type. Use CSV, JSON, TXT, or Markdown for this first intake version.",
      issues: ["Unsupported file type."],
    };
  }

  const text = await file.text();
  const profile =
    kind === "csv"
      ? profileCsv(file, text)
      : kind === "json"
        ? profileJson(text)
        : profileText(kind, text);

  return {
    ...base,
    ...profile,
  };
}

export function formatAttachmentProfilesForPrompt(attachments: StrategyBuilderAttachmentProfile[]) {
  if (!attachments.length) return "No user attachments provided.";

  return attachments
    .map((attachment, index) => {
      const lines = [
        `Attachment ${index + 1}: ${attachment.name}`,
        `Kind: ${attachment.kind}`,
        `Size: ${attachment.size} bytes`,
        `Summary: ${attachment.summary}`,
        attachment.columns?.length ? `Columns: ${attachment.columns.join(", ")}` : "",
        typeof attachment.rowCount === "number" ? `Rows: ${attachment.rowCount}` : "",
        attachment.sampleRows?.length ? `Sample rows: ${JSON.stringify(attachment.sampleRows)}` : "",
        attachment.textPreview ? `Text preview: ${attachment.textPreview}` : "",
        attachment.issues?.length ? `Issues: ${attachment.issues.join("; ")}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}
