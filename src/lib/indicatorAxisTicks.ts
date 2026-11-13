type AxisDomain = { min: number; max: number };

export function indicatorAxisTicks(domain: AxisDomain, height: number, percent = false, width = 64) {
  const { min, max } = domain;
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span) || !Number.isFinite(height) || height < 12) return [];

  const target = span / Math.max(1, Math.floor(height / 23));
  if (!(target > 0)) return [];
  const power = 10 ** Math.floor(Math.log10(target));
  const increments = [1, 2, 2.5, 5, 10];
  const index = increments.findIndex(value => value * power >= target);
  let multiplier = increments[index] ?? 10;
  if (Math.ceil(min / (multiplier * power)) > Math.floor(max / (multiplier * power))) {
    multiplier = increments[index - 1] ?? 0.5;
  }
  const step = multiplier * power;
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return [];

  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  const unit = !percent && magnitude >= 10_000 && step >= 1
    ? ([[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]] as const).find(([scale]) => magnitude >= scale)
    : undefined;
  const scale = unit?.[0] ?? 1;
  const suffix = percent ? "%" : unit?.[1] ?? "";
  const scaledStep = step / scale;
  const decimals = Math.max(0, -Math.floor(Math.log10(scaledStep) + 1e-9) + (multiplier === 2.5 ? 1 : 0));
  const maxCharacters = Math.max(5, Math.floor((width - 9) / 5.6));
  return Array.from({ length: Math.min(100, Math.max(0, last - first + 1)) }, (_, i) => {
    const value = Number(((first + i) * step).toPrecision(15));
    const scaled = value / scale;
    const fixed = decimals <= 12 ? scaled.toFixed(decimals).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1") : "";
    const label = scaled === 0 ? "0" : fixed && fixed.length + suffix.length <= maxCharacters
      ? fixed
      : scaled.toExponential(Math.min(14, Math.max(0, Math.ceil(Math.log10(Math.abs(scaled) / scaledStep))))).replace("e+", "e");
    return { value, label: label + suffix };
  });
}
