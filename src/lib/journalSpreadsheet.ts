import { read, utils } from "xlsx";
import {
  journalHeaderScore,
  parseJournalRows,
  type JournalParseResult,
} from "@/lib/journal";

const HEADER_SEARCH_LIMIT = 100;
const MINIMUM_HEADER_SCORE = 5;
const SYMBOL_LABELS = new Set(["symbol", "ticker", "instrument", "market", "contract"]);
const COMMON_FUTURES = ["MES", "MNQ", "M2K", "MYM", "ES", "NQ", "RTY", "YM", "CL", "MCL", "GC", "MGC", "SI", "HG", "NG", "ZB", "ZN", "ZF", "ZT"];

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isBlankRow(row: unknown[]) {
  return !row.some((cell) => text(cell) !== "");
}

function cleanSymbol(value: unknown) {
  const source = text(value).toUpperCase();
  if (!source || source.length > 40) return "";
  const namespaceMatch = source.match(/(?:^|:)([A-Z0-9._!-]{1,24})$/);
  const symbol = (namespaceMatch?.[1] ?? source).replace(/[^A-Z0-9._!-]/g, "");
  return /[A-Z]/.test(symbol) ? symbol : "";
}

function workbookSymbol(rowsBySheet: Array<{ name: string; rows: unknown[][] }>, fileName: string) {
  for (const { rows } of rowsBySheet) {
    for (const row of rows.slice(0, 60)) {
      if (journalHeaderScore(row) >= MINIMUM_HEADER_SCORE) continue;
      for (let index = 0; index < Math.min(row.length, 24); index += 1) {
        const cell = text(row[index]);
        const label = normalized(cell);
        if (SYMBOL_LABELS.has(label)) {
          const adjacent = cleanSymbol(row[index + 1]);
          if (adjacent) return adjacent;
        }
        const labelled = cell.match(/(?:symbol|ticker|instrument|market|contract)\s*[:=-]\s*([A-Z0-9._:!-]{1,32})/i);
        if (labelled) {
          const candidate = cleanSymbol(labelled[1]);
          if (candidate) return candidate;
        }
      }
    }
  }

  const upperFileName = fileName.toUpperCase();
  return COMMON_FUTURES.find((symbol) => new RegExp(`(?:^|[^A-Z0-9])${symbol}(?:[^A-Z0-9]|$)`).test(upperFileName)) ?? "";
}

function uniqueHeaders(cells: unknown[]) {
  const counts = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = text(cell) || `column_${index + 1}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function tableFromSheet(rows: unknown[][]) {
  let headerIndex = -1;
  let bestScore = -1;
  rows.slice(0, HEADER_SEARCH_LIMIT).forEach((row, index) => {
    const score = journalHeaderScore(row);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });
  if (headerIndex < 0 || bestScore < MINIMUM_HEADER_SCORE) return null;

  const headers = uniqueHeaders(rows[headerIndex]);
  const records: Array<Record<string, unknown>> = [];
  const sourceRowNumbers: number[] = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (isBlankRow(row)) return;
    records.push(Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    sourceRowNumbers.push(headerIndex + offset + 2);
  });
  return { records, sourceRowNumbers };
}

export async function parseJournalSpreadsheetFile(
  fileName: string,
  buffer: ArrayBuffer,
  account: string,
  importId: string,
): Promise<JournalParseResult> {
  let workbook: ReturnType<typeof read>;
  try {
    workbook = read(buffer, { type: "array", cellDates: true, dense: true });
  } catch {
    return {
      trades: [],
      detectedSchema: "workbook",
      sourceRows: 0,
      rejectedRows: 0,
      warnings: ["The workbook could not be opened. Check that it is not password protected or damaged."],
    };
  }

  const rowsBySheet = workbook.SheetNames.map((name) => ({
    name,
    rows: utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: true,
    }),
  }));
  const symbolFallback = workbookSymbol(rowsBySheet, fileName);
  const trades: JournalParseResult["trades"] = [];
  const warnings: string[] = [];
  let sourceRows = 0;
  let rejectedRows = 0;
  let recognizedSheets = 0;

  for (const { name, rows } of rowsBySheet) {
    if (!rows.length || rows.every(isBlankRow)) continue;
    const table = tableFromSheet(rows);
    if (!table || !table.records.length) {
      warnings.push(`${name}: no recognized closed-trade or execution table was found; the sheet was not silently converted.`);
      continue;
    }
    recognizedSheets += 1;
    const result = parseJournalRows(fileName, table.records, account, importId, {
      sourceSheet: name,
      sourceRowNumbers: table.sourceRowNumbers,
      symbolFallback: symbolFallback || undefined,
    });
    trades.push(...result.trades);
    sourceRows += result.sourceRows;
    rejectedRows += result.rejectedRows;
    warnings.push(...result.warnings.map((warning) => `${name}: ${warning}`));
  }

  if (!recognizedSheets) {
    warnings.unshift("No supported trade table was found in any worksheet. Summary sheets were preserved as warnings instead of being mistaken for trades.");
  }

  return {
    trades,
    detectedSchema: "workbook",
    sourceRows,
    rejectedRows,
    warnings: warnings.slice(0, 40),
  };
}
