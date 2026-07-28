import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MnqHistoryQuery = {
  interval?: string;
  limit?: number;
  fromDate?: string | null;
  toDate?: string | null;
};

export type MnqHistoryResponse = {
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    symbol: string;
  }>;
  source: string;
  interval: string;
  available_from: string;
  available_to: string;
  count: number;
};

export async function getMnqHistory(query: MnqHistoryQuery = {}): Promise<MnqHistoryResponse> {
  const scriptPath = path.join(process.cwd(), "scripts", "query_mnq_history.py");
  const args = [scriptPath, "--interval", query.interval ?? "5m", "--limit", String(query.limit ?? 5000)];

  if (query.fromDate) {
    args.push("--from-date", query.fromDate);
  }

  if (query.toDate) {
    args.push("--to-date", query.toDate);
  }

  const { stdout, stderr } = await execFileAsync("python", args, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 64,
  });

  if (stderr?.trim()) {
    console.warn(stderr);
  }

  return JSON.parse(stdout) as MnqHistoryResponse;
}
