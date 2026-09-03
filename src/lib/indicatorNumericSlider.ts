export type IndicatorSliderModel = {
  min: number;
  max: number;
  step: number;
  precision: number;
  value: number;
  logarithmic: boolean;
  symmetricLogarithmic: boolean;
  railMin: number;
  railMax: number;
  railStep: number;
  railValue: number;
  fillPercent: number;
};

function decimalPlaces(value: number) {
  const text = String(value).toLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1]) || 0;
  return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
}

export function normalizeIndicatorNumericValue(
  requested: number,
  fallback: number,
  min: number,
  max: number,
  step = 1,
) {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + safeStep;
  const precision = Math.max(decimalPlaces(safeStep), decimalPlaces(safeMin), decimalPlaces(safeMax));
  const source = Number.isFinite(requested) ? requested : fallback;
  const clamped = Math.min(safeMax, Math.max(safeMin, Number.isFinite(source) ? source : safeMin));
  const stepped = safeMin + Math.round((clamped - safeMin) / safeStep) * safeStep;
  return Number(Math.min(safeMax, Math.max(safeMin, stepped)).toFixed(Math.min(12, precision + 2)));
}

export function indicatorSliderModel(value: number, min: number, max: number, step = 1): IndicatorSliderModel {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + safeStep;
  const precision = Math.max(decimalPlaces(safeStep), decimalPlaces(safeMin), decimalPlaces(safeMax));
  const normalizedValue = normalizeIndicatorNumericValue(value, safeMin, safeMin, safeMax, safeStep);
  const intervalCount = (safeMax - safeMin) / safeStep;
  const logarithmic = safeMin >= 0 && intervalCount > 2_000;
  const symmetricLogarithmic = safeMin < 0 && safeMax > 0 && intervalCount > 2_000;
  const transformedRail = logarithmic || symmetricLogarithmic;
  const railMin = transformedRail ? 0 : safeMin;
  const railMax = transformedRail ? 1_000 : safeMax;
  const railStep = transformedRail ? 1 : safeStep;
  let railValue = normalizedValue;
  if (logarithmic) {
    railValue = Math.log1p((normalizedValue - safeMin) / safeStep) / Math.log1p(intervalCount) * railMax;
  } else if (symmetricLogarithmic) {
    if (normalizedValue < 0) {
      railValue = 500 * (1 - Math.log1p(Math.abs(normalizedValue) / safeStep) / Math.log1p(Math.abs(safeMin) / safeStep));
    } else if (normalizedValue > 0) {
      railValue = 500 + 500 * Math.log1p(normalizedValue / safeStep) / Math.log1p(safeMax / safeStep);
    } else {
      railValue = 500;
    }
  }
  return {
    min: safeMin,
    max: safeMax,
    step: safeStep,
    precision,
    value: normalizedValue,
    logarithmic,
    symmetricLogarithmic,
    railMin,
    railMax,
    railStep,
    railValue,
    fillPercent: Math.min(100, Math.max(0, (railValue - railMin) / (railMax - railMin) * 100)),
  };
}

export function indicatorValueFromRail(position: number, model: IndicatorSliderModel) {
  const boundedPosition = Math.min(model.railMax, Math.max(model.railMin, position));
  let requested = boundedPosition;
  if (model.logarithmic) {
    requested = model.min + Math.expm1(
      boundedPosition / model.railMax * Math.log1p((model.max - model.min) / model.step),
    ) * model.step;
  } else if (model.symmetricLogarithmic) {
    requested = boundedPosition < 500
      ? -Math.expm1((500 - boundedPosition) / 500 * Math.log1p(Math.abs(model.min) / model.step)) * model.step
      : Math.expm1((boundedPosition - 500) / 500 * Math.log1p(model.max / model.step)) * model.step;
  }
  return normalizeIndicatorNumericValue(requested, model.value, model.min, model.max, model.step);
}

export function formatIndicatorNumericValue(value: number, precision: number) {
  if (!Number.isFinite(value)) return "0";
  return precision > 0 ? String(Number(value.toFixed(precision))) : String(Math.round(value));
}
