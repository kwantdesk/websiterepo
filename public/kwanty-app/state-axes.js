// State uses the same price/time transform for data, axes and cursor labels.
// Exposure remains a separate horizontal scale; it is never a time source.
const formatters = new Map();
function clock(timeZone, mode) {
  const key = `${timeZone}:${mode}`;
  if (formatters.has(key)) return formatters.get(key);
  const options = { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  if (mode !== 'minutes' && mode !== 'axisDate') options.second = '2-digit';
  if (mode === 'milliseconds' || mode === 'dateMilliseconds') options.fractionalSecondDigits = 3;
  if (mode.startsWith('date')) Object.assign(options, { month: 'short', day: '2-digit', timeZoneName: 'shortOffset' });
  if (mode === 'axisDate') Object.assign(options, { month: 'short', day: '2-digit' });
  let formatter;
  try { formatter = new Intl.DateTimeFormat('en-US', options); }
  catch { formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'America/New_York' }); }
  if (formatters.size >= 16) formatters.clear();
  formatters.set(key, formatter);
  return formatter;
}

export function statePriceScale(min, max, height) {
  if (![min, max, height].every(Number.isFinite) || max <= min || height <= 0) return { values: [], decimals: 2 };
  const ideal = (max - min) / Math.max(2, height / 48);
  const power = 10 ** Math.floor(Math.log10(ideal));
  const step = ([1, 2, 2.5, 5, 10].find(n => n * power >= ideal) || 10) * power;
  const decimals = Math.max(2, Math.min(8, 1 - Math.floor(Math.log10(step))));
  const first = Math.ceil(min / step) * step;
  const count = Math.min(100, Math.max(0, Math.floor((max - first) / step + 1e-9) + 1));
  return { step, decimals, values: Array.from({ length: count }, (_, i) => Number((first + i * step).toPrecision(15))) };
}

export function stateAxisLabels(g, settings = {}) {
  const price = statePriceScale(g.minPrice, g.maxPrice, g.bottom - g.top);
  const span = g.endTime - g.startTime;
  const hasTime = Number.isFinite(g.startTime) && Number.isFinite(g.endTime) && span > 0;
  const mode = span <= 10_000 ? 'milliseconds' : span <= 120_000 ? 'seconds' : span >= 86_400_000 ? 'axisDate' : 'minutes';
  const formatter = clock(settings.timeZone || 'America/New_York', mode);
  const count = Math.max(1, Math.min(8, Math.floor((g.right - g.left) / (mode === 'axisDate' ? 170 : 100))));
  const ideal = span / count;
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000,
    60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000,
    7_200_000, 14_400_000, 21_600_000, 43_200_000, 86_400_000, 604_800_000].find(n => n >= ideal)
    || Math.ceil(ideal / 604_800_000) * 604_800_000;
  const first = Math.ceil(g.startTime / step) * step;
  const timeCount = hasTime ? Math.max(0, Math.min(10, Math.floor((g.endTime - first) / step) + 1)) : 0;
  const time = Array.from({ length: timeCount }, (_, i) => {
    const value = first + i * step;
    return { value, x: g.timeX(value), text: formatter.format(value) };
  });
  return {
    decimals: price.decimals,
    price: price.values.map(value => ({ value, y: g.priceY(value), text: value.toFixed(price.decimals) })),
    time,
  };
}

export function stateCrosshairReadout(g, point, settings = {}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const hit = g.hitTest(point.x, point.y);
  if (!hit || !Number.isFinite(hit.price)) return null;
  const scale = statePriceScale(g.minPrice, g.maxPrice, g.bottom - g.top);
  return {
    x: point.x, y: point.y, price: hit.price, time: hit.time,
    priceText: hit.price.toFixed(scale.decimals),
    timeText: Number.isFinite(hit.time) ? clock(settings.timeZone || 'America/New_York', g.endTime-g.startTime <= 10_000 ? 'dateMilliseconds' : 'date').format(hit.time) : null,
  };
}

export function drawStateAxes(ctx, g, settings, ink) {
  const labels = stateAxisLabels(g, settings);
  ctx.save();
  ctx.font = '11px Aleph, sans-serif';
  ctx.lineWidth = .6;
  ctx.strokeStyle = ink.border;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(g.right + .5, g.top); ctx.lineTo(g.right + .5, g.bottom + .5);
  ctx.lineTo(g.left, g.bottom + .5); ctx.stroke();
  for (const tick of labels.price) {
    if (tick.y < g.top + 8 || tick.y > g.bottom - 8) continue;
    if (settings.showGrid !== false) {
      ctx.beginPath(); ctx.moveTo(g.left, tick.y); ctx.lineTo(g.right, tick.y); ctx.stroke();
    }
    ctx.fillStyle = ink.foreground; ctx.textAlign = 'left';
    ctx.fillText(tick.text, g.right + 8, tick.y + 4);
  }
  for (const tick of labels.time) {
    if (settings.showGrid !== false) {
      ctx.beginPath(); ctx.moveTo(tick.x, g.top); ctx.lineTo(tick.x, g.bottom); ctx.stroke();
    }
    ctx.fillStyle = ink.muted;
    ctx.textAlign = tick.x === g.left ? 'left' : tick.x === g.right ? 'right' : 'center';
    ctx.fillText(tick.text, tick.x, g.bottom + 21);
  }
  ctx.restore();
}

export function drawStateCrosshairLabels(ctx, g, point, settings, width, ink) {
  const readout = stateCrosshairReadout(g, point, settings);
  if (!readout || settings.showCrosshairs === false) return null;
  ctx.save(); ctx.font = '11px Aleph, sans-serif'; ctx.textAlign = 'left';
  const label = (text, x, y, limit) => {
    const w = Math.min(limit, ctx.measureText(text).width + 12);
    ctx.fillStyle = ink.background; ctx.fillRect(x, y, w, 22);
    ctx.fillStyle = ink.foreground; ctx.fillText(text, x + 6, y + 15, w - 10);
  };
  label(readout.priceText, g.right + 1, Math.max(g.top, Math.min(g.bottom - 22, readout.y - 11)), width - g.right - 1);
  if (readout.timeText) {
    const w = Math.min(g.right - g.left, ctx.measureText(readout.timeText).width + 12);
    const x = Math.max(g.left, Math.min(g.right - w, readout.x - w / 2));
    label(readout.timeText, x, g.bottom + 2, w);
  }
  ctx.restore();
  return readout;
}
