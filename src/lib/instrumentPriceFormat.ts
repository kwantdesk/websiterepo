import { futuresTickSize } from "./eventBars.ts";

/** Preserve the selected product's exchange tick, including FX and fractional bonds. */
export function futuresAwarePriceFormat(instrument: string) {
  const symbol = String(instrument).split(":").at(-1) || instrument;
  const minMove = futuresTickSize(symbol);
  const text = String(minMove);
  const precision = text.includes("e-")
    ? Number(text.split("e-")[1])
    : (text.split(".")[1]?.length || 0);
  return { type: "price" as const, precision, minMove };
}
