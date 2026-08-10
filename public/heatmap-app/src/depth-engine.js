const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const BOOKMAP_VISUAL_DEFAULTS = Object.freeze({
  circleSize: 40,
  circleTransparency: 41,
  smartClustering: 52,
  minimumTradeSize: 1,
  minimumPixelVolume: 1,
  heatmapDimming: 40,
  gaussianSigma: 5,
});

export function transformedCircleSize(value) {
  const setting = clamp(Number(value) || 0, 0, 100);
  return Math.floor(Math.pow(setting / 100 * 0.8 + 0.2, 2) * 100);
}

export function smartClusteringParameter(value) {
  const setting = clamp(Number(value) || 0, 0, 100);
  const scaled = setting / 100 * 2.1465;
  return (Math.tan((scaled - 1) * 1.37) / 5 + 1) * Math.pow(scaled, 0.3)
    + Math.pow(Math.max(0, scaled - 1.8), 2) * 10;
}

export function volumeDotDiameter(volume, maximumVolume, {
  circleSize = BOOKMAP_VISUAL_DEFAULTS.circleSize,
  minimumVolume = BOOKMAP_VISUAL_DEFAULTS.minimumPixelVolume,
  drawingType = 'spheres',
} = {}) {
  if (!(volume >= minimumVolume) || !(maximumVolume > 0)) return 0;
  const exponent = drawingType === 'spheres' ? 1 / 3 : 1 / 2;
  const scale = transformedCircleSize(circleSize) * 2 / Math.pow(maximumVolume, exponent);
  return Math.max(6, Math.pow(volume, exponent) * scale);
}

export function volumeDotAlpha(diameter, transparency = BOOKMAP_VISUAL_DEFAULTS.circleTransparency) {
  if (!(diameter > 0)) return 0;
  const alphaFactor = Math.pow(clamp(Number(transparency) || 0, 0, 100) / 100, 1.5);
  const fade = alphaFactor * (Math.min(diameter, 40) - 6) / 34;
  return Math.round(clamp(255 * (1 - fade), 0, 255));
}

const groupWeight = group => group.gross || group.total;
const groupIndex = group => group.indexTotal / groupWeight(group);
const groupTick = group => group.tickTotal / groupWeight(group);

function smartMergeScore(left, right, parameter, columnPixels, rowTicks, rowPixels) {
  let leftRadius = Math.max(Math.cbrt(left.total) / 2 * parameter, 0.1);
  let rightRadius = Math.max(Math.cbrt(right.total) / 2 * parameter, 0.1);
  if (leftRadius < rightRadius) [leftRadius, rightRadius] = [rightRadius, leftRadius];
  const dx = (groupIndex(left) - groupIndex(right)) * columnPixels;
  const dy = (groupTick(left) - groupTick(right)) / rowTicks * rowPixels;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const core = 3 * parameter;
  if (distance < 2 * core) return -1 / distance;
  if (distance < core * (leftRadius + rightRadius) / rightRadius) {
    return (distance - core) / leftRadius;
  }
  return distance / (leftRadius + rightRadius);
}

function mergeTradeGroups(left, right, differential) {
  const gross = groupWeight(left) + groupWeight(right);
  const roundedIndex = Math.round((left.indexTotal + right.indexTotal) / gross);
  let buyVolume = left.buyVolume + right.buyVolume;
  let sellVolume = left.sellVolume + right.sellVolume;
  const cancelled = differential ? Math.min(buyVolume, sellVolume) : 0;
  buyVolume -= cancelled;
  sellVolume -= cancelled;
  return {
    indexTotal: roundedIndex * gross,
    tickTotal: left.tickTotal + right.tickTotal,
    buyVolume,
    sellVolume,
    total: buyVolume + sellVolume,
    gross,
    firstTimestamp: Math.min(left.firstTimestamp, right.firstTimestamp),
    timestamp: Math.max(left.timestamp, right.timestamp),
    minimumIndex: Math.min(left.minimumIndex, right.minimumIndex),
    maximumIndex: Math.max(left.maximumIndex, right.maximumIndex),
    key: left.key < right.key ? left.key : right.key,
    count: left.count + right.count,
  };
}

function mergeNearbyTrades(groups, options) {
  const distanceLimit = smartClusteringParameter(options.smartClustering) * 6;
  if (!(distanceLimit > 0) || groups.length < 2) return groups;
  let working = groups;
  for (let pass = 0; pass < 20 && working.length > 1; pass += 1) {
    working.sort((left, right) => groupIndex(left) - groupIndex(right) || groupTick(left) - groupTick(right));
    const consumed = new Set();
    const next = [];
    let mergeCount = 0;
    for (let index = 0; index < working.length; index += 1) {
      if (consumed.has(index)) continue;
      const left = working[index];
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let candidateIndex = index + 1; candidateIndex < Math.min(working.length, index + 11); candidateIndex += 1) {
        if (consumed.has(candidateIndex)) continue;
        const candidate = working[candidateIndex];
        const dx = (groupIndex(candidate) - groupIndex(left)) * options.columnPixels;
        if (dx >= distanceLimit) break;
        const dy = (groupTick(candidate) - groupTick(left)) / options.rowTicks * options.rowPixels;
        const distance = Math.hypot(dx, dy);
        if (distance < distanceLimit && distance < bestDistance) {
          bestDistance = distance;
          bestIndex = candidateIndex;
        }
      }
      if (bestIndex >= 0) {
        consumed.add(bestIndex);
        next.push(mergeTradeGroups(left, working[bestIndex], options.differential));
        mergeCount += 1;
      } else {
        next.push(left);
      }
    }
    working = next.filter(group => group.total > 0);
    if (mergeCount === 0) break;
  }
  return working;
}

function applySmartClustering(groups, options) {
  const parameter = smartClusteringParameter(options.smartClustering);
  let working = groups;
  for (let pass = 0; pass < 20 && working.length > 1; pass += 1) {
    working.sort((left, right) => groupIndex(left) - groupIndex(right) || groupTick(left) - groupTick(right));
    const referenceVolume = working.reduce((maximum, group) => Math.max(maximum, group.total), 1);
    const targetScale = transformedCircleSize(options.circleSize) * 2
      / Math.cbrt(referenceVolume);
    const consumed = new Set();
    const next = [];
    let mergeCount = 0;
    for (let index = 0; index < working.length; index += 1) {
      if (consumed.has(index)) continue;
      const left = working[index];
      let bestIndex = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let candidateIndex = index + 1; candidateIndex < Math.min(working.length, index + 11); candidateIndex += 1) {
        if (consumed.has(candidateIndex)) continue;
        const candidate = working[candidateIndex];
        const score = smartMergeScore(
          left,
          candidate,
          parameter,
          options.columnPixels,
          options.rowTicks,
          options.rowPixels,
        );
        if (score < bestScore) {
          bestScore = score;
          bestIndex = candidateIndex;
        }
      }
      if (bestIndex >= 0 && bestScore <= targetScale) {
        consumed.add(bestIndex);
        next.push(mergeTradeGroups(left, working[bestIndex], options.differential));
        mergeCount += 1;
      } else {
        next.push(left);
      }
    }
    working = next.filter(group => group.total > 0);
    if (mergeCount === 0) break;
  }
  return working;
}

function quantile(sorted, fraction) {
  if (!sorted.length) return 0;
  const position = clamp(fraction, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const mix = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * mix;
}

function shapeBrightness(value, splitX, splitY) {
  if (value <= splitX) return splitX === 0 ? value : value * splitY / splitX;
  return splitX === 1
    ? value
    : splitY + (value - splitX) * (1 - splitY) / (1 - splitX);
}

export function enhanceHeatIntensity(current, previous, gain = 1) {
  return Math.round(clamp(current + (current - previous) * gain, 0, 255));
}

export class AdaptiveContrast {
  constructor({
    blackPercentile = 0.15,
    whitePercentile = 0.96,
    equalization = 0.50,
    splitX = 0.60,
    splitY = 0.70,
    colorMapSplit = 0.90,
    refreshColumns = 105,
  } = {}) {
    this.blackPercentile = blackPercentile;
    this.whitePercentile = whitePercentile;
    this.equalization = equalization;
    this.splitX = splitX;
    this.splitY = splitY;
    this.colorMapSplit = colorMapSplit;
    this.refreshColumns = refreshColumns;
    this.black = 0;
    this.white = 1;
    this.maximum = 1;
    this.cdf = new Float32Array(256);
    for (let index = 0; index < this.cdf.length; index += 1) this.cdf[index] = index / 255;
    this.lastToken = -Infinity;
    this.version = 0;
  }

  reset() {
    this.black = 0;
    this.white = 1;
    this.maximum = 1;
    this.lastToken = -Infinity;
    this.version += 1;
  }

  update(columns, token, force = false) {
    const expired = token - this.lastToken >= this.refreshColumns;
    if (!force && this.version > 0 && !expired) {
      const newest = columns.at(-1);
      let newestMaximum = 0;
      for (let index = 0; index < (newest?.length || 0); index += 1) {
        newestMaximum = Math.max(newestMaximum, newest[index]);
      }
      // The retained history still contains the previous maximum. Unless a
      // genuinely larger wall arrives, there is no reason to rescan and sort
      // every visible depth cell merely to rediscover the same contrast.
      if (newestMaximum <= this.maximum * 1.2) return false;
    }

    const values = [];
    let maximum = 0;
    let population = 0;

    for (const column of columns) population += column.length;
    const stride = Math.max(1, Math.floor(population / 24000));
    let cursor = 0;
    for (const column of columns) {
      for (let row = 0; row < column.length; row += 1) {
        const value = column[row];
        if (value > maximum) maximum = value;
        if (value > 0 && cursor % stride === 0) values.push(value);
        cursor += 1;
      }
    }

    if (!values.length) return false;
    const rangeChange = Math.abs(maximum - this.maximum) / Math.max(1, this.maximum);
    if (!force && this.version > 0 && !expired && rangeChange <= 0.2) return false;

    values.sort((left, right) => left - right);
    const black = quantile(values, this.blackPercentile);
    let white = quantile(values, this.whitePercentile);
    if (white <= black) white = Math.max(black + 1, maximum);

    const histogram = new Uint32Array(256);
    const span = Math.max(1e-9, white - black);
    for (const value of values) {
      // Cutoff populations should not crowd the first or last color band. The
      // retained distribution alone controls equalization; clipped values are
      // still handled explicitly by map().
      if (!(value > black) || value > white) continue;
      const normalized = clamp((value - black) / span, 0, 1);
      histogram[Math.min(255, Math.floor(normalized * 255))] += 1;
    }
    const retainedPopulation = histogram.reduce((sum, count) => sum + count, 0);
    let cumulative = 0;
    for (let index = 0; index < histogram.length; index += 1) {
      const count = histogram[index];
      // Use the midpoint of each histogram mass. Inclusive CDF values make a
      // common resting size jump too far up the palette and flatten the sizes
      // above it into nearly identical colors.
      this.cdf[index] = retainedPopulation > 0
        ? (cumulative + count * 0.5) / retainedPopulation
        : index / 255;
      cumulative += count;
    }

    this.black = black;
    this.white = white;
    this.maximum = Math.max(1, maximum);
    this.lastToken = token;
    this.version += 1;
    return true;
  }

  map(value, sensitivity = 1) {
    if (!(value > this.black)) return 0;
    if (value > this.white && this.maximum > this.white) {
      const extension = clamp((value - this.white) / (this.maximum - this.white), 0, 1);
      return Math.round((this.colorMapSplit + (1 - this.colorMapSplit) * extension) * 255);
    }
    const linear = clamp((value - this.black) / Math.max(1e-9, this.white - this.black), 0, 1);
    const equalized = this.cdf[Math.min(255, Math.floor(linear * 255))];
    const blended = linear * (1 - this.equalization) + equalized * this.equalization;
    const curved = shapeBrightness(blended, this.splitX, this.splitY);
    const sensitive = Math.pow(clamp(curved, 0, 1), 1 / clamp(sensitivity, 0.2, 4));
    const paletteSpan = this.maximum > this.white ? this.colorMapSplit : 1;
    return Math.round(sensitive * paletteSpan * 255);
  }

  describe() {
    return {
      black: this.black,
      white: this.white,
      maximum: this.maximum,
      colorMapSplit: this.colorMapSplit,
      version: this.version,
    };
  }
}

function geometryKey({
  bottomTick, topTick, rowTicks, filterType, gaussianSigma, rowPixels, cumulative,
}) {
  return [
    bottomTick.toFixed(4), topTick.toFixed(4), rowTicks,
    filterType, gaussianSigma.toFixed(3), rowPixels.toFixed(3), cumulative ? 1 : 0,
  ].join(':');
}

function smoothSide(source) {
  const output = new Float64Array(source.length);
  for (let row = 0; row < source.length; row += 1) {
    const previous = source[Math.max(0, row - 1)];
    const current = source[row];
    const next = source[Math.min(source.length - 1, row + 1)];
    output[row] = (previous + current * 2 + next) / 4;
  }
  return output;
}

function gaussianSmoothSide(source, sigma, { replicateStart = false, replicateEnd = false } = {}) {
  if (!(sigma >= 0.01)) return source;
  let start = 0;
  while (start < source.length && source[start] === 0) start += 1;
  let end = source.length - 1;
  while (end >= start && source[end] === 0) end -= 1;
  if (end < start) return source;
  const radius = Math.max(1, Math.min(32, Math.round(sigma * 2.5)));
  const weights = new Float64Array(radius * 2 + 1);
  let weightTotal = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    weights[offset + radius] = weight;
    weightTotal += weight;
  }
  const output = new Float64Array(source.length);
  for (let row = start; row <= end; row += 1) {
    let value = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sourceRow = row + offset;
      const weight = weights[offset + radius];
      const sourceValue = sourceRow < start
        ? (replicateStart ? source[start] : 0)
        : sourceRow > end
          ? (replicateEnd ? source[end] : 0)
          : source[sourceRow];
      value += sourceValue * weight;
    }
    output[row] = value / Math.max(Number.EPSILON, weightTotal);
  }
  return output;
}

function cumulativeFromTouch(values, fromTop) {
  let running = 0;
  if (fromTop) {
    for (let row = 0; row < values.length; row += 1) {
      running += values[row];
      values[row] = running;
    }
  } else {
    for (let row = values.length - 1; row >= 0; row -= 1) {
      running += values[row];
      values[row] = running;
    }
  }
}

export class RollingDepthEngine {
  constructor(capacity = 1800, options = {}) {
    this.capacity = capacity;
    this.frames = [];
    this.revision = 0;
    this.contrast = new AdaptiveContrast(options.contrast);
    this.columnCache = new WeakMap();
    this.lastHeatmap = null;
  }

  reset() {
    this.frames.length = 0;
    this.revision = 0;
    this.columnCache = new WeakMap();
    this.lastHeatmap = null;
    this.contrast.reset();
  }

  append(frame) {
    this.frames.push(frame);
    let shifted = 0;
    while (this.frames.length > this.capacity) {
      this.frames.shift();
      shifted += 1;
    }
    this.revision += 1;
    return { shifted, length: this.frames.length, revision: this.revision };
  }

  #rawColumn(frame, geometry) {
    let cache = this.columnCache.get(frame);
    if (!cache) {
      cache = new Map();
      this.columnCache.set(frame, cache);
    }
    const key = geometryKey(geometry);
    if (cache.has(key)) return cache.get(key);

    const rows = Math.max(1, Math.ceil((geometry.topTick - geometry.bottomTick) / geometry.rowTicks));
    let bidRows = new Float64Array(rows);
    let askRows = new Float64Array(rows);
    const addBook = (book, target) => {
      for (const [tick, size] of book) {
        if (tick < geometry.bottomTick || tick > geometry.topTick || size <= 0) continue;
        const row = Math.floor((geometry.topTick - tick) / geometry.rowTicks);
        if (row >= 0 && row < rows) target[row] += size;
      }
    };
    addBook(frame.bids, bidRows);
    addBook(frame.asks, askRows);

    let sigmaRows = 0;
    if (geometry.filterType === 'auto' && geometry.rowPixels < 15) {
      sigmaRows = 5 / Math.max(0.01, geometry.rowPixels);
    } else if (geometry.filterType === 'gaussian') {
      sigmaRows = geometry.gaussianSigma / Math.max(0.01, geometry.rowPixels);
    } else if (geometry.filterType === 'average') {
      bidRows = smoothSide(bidRows);
      askRows = smoothSide(askRows);
    }
    if (sigmaRows >= 0.01) {
      bidRows = gaussianSmoothSide(bidRows, sigmaRows, { replicateStart: true });
      askRows = gaussianSmoothSide(askRows, sigmaRows, { replicateEnd: true });
    }
    if (geometry.cumulative) {
      cumulativeFromTouch(askRows, true);
      cumulativeFromTouch(bidRows, false);
    }

    const combined = new Float64Array(rows);
    for (let row = 0; row < rows; row += 1) combined[row] = bidRows[row] + askRows[row];
    cache.set(key, combined);
    return combined;
  }

  buildHeatmap({
    start = 0,
    end = this.frames.length - 1,
    bottomTick,
    topTick,
    rowTicks = 1,
    smooth = false,
    filterType = smooth ? 'average' : 'auto',
    gaussianSigma = BOOKMAP_VISUAL_DEFAULTS.gaussianSigma,
    rowPixels = 16,
    cumulative = false,
    sensitivity = 1,
    temporalEnhancement = 1,
    forceContrast = false,
  }) {
    if (!this.frames.length || end < start) {
      return {
        width: 0, height: 0, intensities: new Uint8ClampedArray(),
        updateStart: 0, shiftColumns: 0, reusedColumns: 0,
        contrast: this.contrast.describe(),
      };
    }

    const safeStart = clamp(Math.floor(start), 0, this.frames.length - 1);
    const safeEnd = clamp(Math.floor(end), safeStart, this.frames.length - 1);
    const geometry = {
      bottomTick,
      topTick,
      rowTicks,
      filterType,
      gaussianSigma,
      rowPixels,
      cumulative,
    };
    const rawColumns = [];
    for (let index = safeStart; index <= safeEnd; index += 1) {
      rawColumns.push(this.#rawColumn(this.frames[index], geometry));
    }

    const token = this.frames[safeEnd].id ?? this.revision;
    const contrastChanged = this.contrast.update(rawColumns, token, forceContrast);
    const width = rawColumns.length;
    const height = rawColumns[0]?.length || 0;
    const visibleFrames = this.frames.slice(safeStart, safeEnd + 1);
    const startFrame = visibleFrames[0];
    const endFrame = visibleFrames[visibleFrames.length - 1];
    const styleKey = [geometryKey(geometry), sensitivity.toFixed(4), temporalEnhancement.toFixed(4), this.contrast.version].join('|');
    const previous = this.lastHeatmap;
    let shiftColumns = 0;
    let updateStart = 0;
    let reusedColumns = 0;
    let base = new Uint8ClampedArray(width * height);
    let intensities = new Uint8ClampedArray(width * height);

    if (!contrastChanged && previous && previous.styleKey === styleKey && previous.width === width && previous.height === height) {
      // Display-held frames intentionally use half-step sequence ids. Numeric
      // id subtraction therefore cannot describe how many raster columns
      // rolled off once the fixed-capacity buffer fills. Track the exact frame
      // overlap instead so every shift is an integer column count.
      const advance = previous.frames?.indexOf(startFrame) ?? -1;
      const sameEndFrame = previous.frames?.[previous.frames.length - 1] === endFrame;
      if (advance === 0 && sameEndFrame) {
        base = previous.base;
        intensities = previous.intensities;
        updateStart = width;
        reusedColumns = width;
      } else if (advance > 0 && advance < width && !sameEndFrame) {
        shiftColumns = advance;
        updateStart = width - advance;
        reusedColumns = updateStart;
        for (let row = 0; row < height; row += 1) {
          const oldOffset = row * width + advance;
          const newOffset = row * width;
          base.set(previous.base.subarray(oldOffset, oldOffset + updateStart), newOffset);
          intensities.set(previous.intensities.subarray(oldOffset, oldOffset + updateStart), newOffset);
        }
      }
    }

    if (updateStart < width) {
      for (let x = updateStart; x < width; x += 1) {
        const raw = rawColumns[x];
        for (let row = 0; row < height; row += 1) {
          const offset = row * width + x;
          const current = this.contrast.map(raw[row], sensitivity);
          base[offset] = current;
          const previousValue = x > 0 ? base[offset - 1] : current;
          intensities[offset] = enhanceHeatIntensity(current, previousValue, temporalEnhancement);
        }
      }
    }

    this.lastHeatmap = {
      width, height, frames: visibleFrames, styleKey, base, intensities,
    };
    return {
      width,
      height,
      intensities,
      updateStart,
      shiftColumns,
      reusedColumns,
      contrastChanged,
      contrast: this.contrast.describe(),
    };
  }

  clusterTrades({
    start = 0,
    end = this.frames.length - 1,
    rowTicks = 1,
    rowPixels = 1,
    columnPixels = 1,
    bubbleScale,
    circleSize = bubbleScale == null
      ? BOOKMAP_VISUAL_DEFAULTS.circleSize
      : clamp(BOOKMAP_VISUAL_DEFAULTS.circleSize * bubbleScale, 0, 100),
    circleTransparency = BOOKMAP_VISUAL_DEFAULTS.circleTransparency,
    smartClustering = BOOKMAP_VISUAL_DEFAULTS.smartClustering,
    differential = true,
    minimumVolume,
    minimumTradeSize = BOOKMAP_VISUAL_DEFAULTS.minimumTradeSize,
    minimumPixelVolume = minimumVolume ?? BOOKMAP_VISUAL_DEFAULTS.minimumPixelVolume,
  } = {}) {
    if (!this.frames.length || end < start) return [];
    const safeStart = clamp(Math.floor(start), 0, this.frames.length - 1);
    const safeEnd = clamp(Math.floor(end), safeStart, this.frames.length - 1);
    const activeFrameSpan = Math.max(
      1,
      Math.ceil(smartClusteringParameter(smartClustering) * 6 / Math.max(0.2, columnPixels)),
    );
    const activeFromIndex = safeEnd - activeFrameSpan + 1;
    const groups = new Map();

    for (let index = safeStart; index <= safeEnd; index += 1) {
      const frame = this.frames[index];
      for (let tradeIndex = 0; tradeIndex < frame.trades.length; tradeIndex += 1) {
        const trade = frame.trades[tradeIndex];
        if (trade.size < minimumTradeSize) continue;
        const key = `${index}:${trade.tick}`;
        const group = groups.get(key) || {
          indexTotal: 0,
          tickTotal: 0,
          buyVolume: 0,
          sellVolume: 0,
          total: 0,
          firstTimestamp: trade.timestamp,
          timestamp: trade.timestamp,
          minimumIndex: index,
          maximumIndex: index,
          key: String(trade.id ?? `${trade.timestamp}:${index}:${trade.tick}:${trade.side}:${tradeIndex}`),
          count: 0,
        };
        group.total += trade.size;
        group[trade.side === 'buy' ? 'buyVolume' : 'sellVolume'] += trade.size;
        group.indexTotal += index * trade.size;
        group.tickTotal += trade.tick * trade.size;
        group.timestamp = Math.max(group.timestamp, trade.timestamp);
        group.count += 1;
        groups.set(key, group);
      }
    }

    let grouped = [...groups.values()].map(group => {
      if (!differential) return { ...group, gross: group.total };
      const cancelled = Math.min(group.buyVolume, group.sellVolume);
      return {
        ...group,
        gross: group.total,
        buyVolume: group.buyVolume - cancelled,
        sellVolume: group.sellVolume - cancelled,
        total: group.total - cancelled * 2,
      };
    }).filter(group => group.total > 0);
    grouped = mergeNearbyTrades(grouped, {
      smartClustering,
      differential,
      columnPixels,
      rowTicks,
      rowPixels,
    });
    grouped = applySmartClustering(grouped, {
      smartClustering,
      differential,
      circleSize,
      columnPixels,
      rowTicks,
      rowPixels,
    });
    const volumeReference = Math.max(1, grouped.reduce((maximum, group) => Math.max(maximum, group.total), 0));
    const maximumDiameter = transformedCircleSize(circleSize) * 2;
    return grouped
      .filter(group => group.total >= minimumPixelVolume)
      .map(group => {
        const diameter = Math.min(maximumDiameter, volumeDotDiameter(group.total, volumeReference, {
          circleSize,
          minimumVolume: minimumPixelVolume,
          drawingType: 'spheres',
        }));
        return ({
          key: group.key,
          index: Math.round(groupIndex(group)),
          tick: groupTick(group),
          buyVolume: group.buyVolume,
          sellVolume: group.sellVolume,
          total: group.total,
          buyRatio: group.buyVolume / group.total,
          radius: diameter / 2,
          diameter,
          alpha: volumeDotAlpha(diameter, circleTransparency),
          active: group.maximumIndex >= activeFromIndex,
          firstTimestamp: group.firstTimestamp,
          timestamp: group.timestamp,
          count: group.count,
        });
      })
      .sort((left, right) => left.index - right.index || left.tick - right.tick);
  }
}

export { clamp };
