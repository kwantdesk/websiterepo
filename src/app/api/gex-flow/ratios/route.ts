import { NextRequest, NextResponse } from "next/server";
import type { GexFlowRow } from "@/lib/gexFlow";
import {
  getConfiguredQuantDataApiKey,
  getGexFlowContractRatioEnrichment,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

type ContractIdentity = Pick<GexFlowRow, "osi" | "ticker" | "expirationDate" | "strikePrice" | "contractType">;

function validContract(value: unknown): value is ContractIdentity {
  if (!value || typeof value !== "object") return false;
  const contract = value as Partial<ContractIdentity>;
  return typeof contract.ticker === "string"
    && SYMBOL_PATTERN.test(contract.ticker.toUpperCase())
    && (contract.contractType === "CALL" || contract.contractType === "PUT")
    && typeof contract.expirationDate === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(contract.expirationDate)
    && typeof contract.strikePrice === "number"
    && Number.isFinite(contract.strikePrice)
    && contract.strikePrice > 0
    && (contract.osi === null || typeof contract.osi === "string");
}

export async function POST(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "GEX FLOW options data is not configured." }, { status: 503 });
  }
  try {
    const body = await request.json() as { contracts?: unknown[]; sessionDate?: unknown; replayAt?: unknown };
    const contracts = (Array.isArray(body.contracts) ? body.contracts : []).filter(validContract).slice(0, 25);
    if (!contracts.length) return NextResponse.json({ error: "At least one valid option contract is required." }, { status: 400 });
    if (typeof body.sessionDate !== "string") return NextResponse.json({ error: "A session date is required." }, { status: 400 });
    const payload = await getGexFlowContractRatioEnrichment({
      contracts: contracts.map((contract) => ({ ...contract, ticker: contract.ticker.toUpperCase() })),
      sessionDate: body.sessionDate,
      replayAt: typeof body.replayAt === "string" ? body.replayAt : undefined,
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message, rateLimitRemaining: problem.remaining }, {
      status: problem.status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
