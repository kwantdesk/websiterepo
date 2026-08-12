import { paletteAccents, paletteLut, paletteRenderKey } from './palettes.js';
import { canvasUiTheme } from './ui-themes.js';

function colorCss([red, green, blue], alpha = 1) {
  return alpha >= 1
    ? `rgb(${red}, ${green}, ${blue})`
    : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function dimPalette(palette, level) {
  const dimming = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
  if (dimming === 0) return palette;
  const output = new Uint8ClampedArray(palette.length);
  for (let channel = 0; channel < 3; channel += 1) {
    const floor = palette[channel];
    for (let index = 0; index < 256; index += 1) {
      const offset = index * 3 + channel;
      output[offset] = Math.max(floor, Math.round(palette[offset] - (palette[offset] - floor) * dimming));
    }
  }
  return output;
}

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  // A 2x backing store quadruples the pixels painted on high-DPI and wide
  // trading screens. Keep text crisp while bounding the canvas to roughly
  // five million device pixels, which removes the severe laptop/4K slowdown.
  const areaRatio = Math.sqrt(5_000_000 / Math.max(1, width * height));
  const ratio = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1, areaRatio));
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height, ratio };
}

export function interpolateHeatIntensity(intensities, width, height, x, outputY, outputHeight) {
  if (width <= 0 || height <= 0 || outputHeight <= 0) return 0;
  const sourceY = (outputY + 0.5) * height / outputHeight - 0.5;
  const sourceFloor = Math.floor(sourceY);
  const lowRow = Math.max(0, Math.min(height - 1, sourceFloor));
  const highRow = Math.max(0, Math.min(height - 1, sourceFloor + 1));
  const linearMix = Math.max(0, Math.min(1, sourceY - sourceFloor));
  const mix = linearMix * linearMix * (3 - 2 * linearMix);
  const low = intensities[lowRow * width + x];
  const high = intensities[highRow * width + x];
  return Math.round(low + (high - low) * mix);
}

export function bidAskVolumePercentages(buyVolume, sellVolume) {
  const askVolume = Math.max(0, Number(buyVolume) || 0);
  const bidVolume = Math.max(0, Number(sellVolume) || 0);
  const total = askVolume + bidVolume;
  if (total <= 0) return { bid: 0, ask: 0, bidVolume, askVolume, total };
  const ask = Math.round(askVolume / total * 100);
  return { bid: 100 - ask, ask, bidVolume, askVolume, total };
}

export function aggregateRestingBook(bids, asks, step, bottomTick, topTick) {
  const bandStep = Math.max(1, Number(step) || 1);
  const bands = new Map();
  let maximum = 0;

  const addLevels = (levels, side) => {
    if (!levels) return;
    for (const [rawTick, rawSize] of levels) {
      const tick = Number(rawTick);
      const size = Math.max(0, Number(rawSize) || 0);
      if (!Number.isFinite(tick) || size <= 0 || tick < bottomTick || tick > topTick) continue;
      const bucket = Math.round(tick / bandStep) * bandStep;
      if (bucket < bottomTick || bucket > topTick) continue;
      const value = bands.get(bucket) || { buy: 0, sell: 0 };
      value[side] += size;
      bands.set(bucket, value);
      maximum = Math.max(maximum, value.buy, value.sell);
    }
  };

  // Asks are resting sell orders; bids are resting buy orders.
  addLevels(asks, 'sell');
  addLevels(bids, 'buy');
  return { bands, maximum };
}

function priceLabel(tick, config) {
  return (tick * config.tickSize).toFixed(config.decimals);
}

function timeLabel(timestamp, withMilliseconds = false) {
  const date = new Date(timestamp);
  const base = date.toISOString().slice(11, 19);
  return withMilliseconds ? `${base}.${String(date.getUTCMilliseconds()).padStart(3, '0')}` : base.slice(0, 5);
}

function timestampLowerBound(points, target, high = points.length) {
  let low = 0;
  let upper = Math.max(0, Math.min(points.length, high));
  while (low < upper) {
    const middle = (low + upper) >>> 1;
    if (Number(points[middle]?.timestamp) < target) low = middle + 1;
    else upper = middle;
  }
  return low;
}

function timestampUpperBound(points, target) {
  let low = 0;
  let upper = points.length;
  while (low < upper) {
    const middle = (low + upper) >>> 1;
    if (Number(points[middle]?.timestamp) <= target) low = middle + 1;
    else upper = middle;
  }
  return low;
}

function niceTickStep(totalTicks) {
  const raw = Math.max(1, totalTicks / 10);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return Math.max(1, Math.round(factor * magnitude));
}

export class DepthRenderer {
  constructor(canvas, cvdCanvas, depthEngine) {
    this.canvas = canvas;
    this.cvdCanvas = cvdCanvas;
    this.depthEngine = depthEngine;
    this.heatBuffer = document.createElement('canvas');
    this.heatContext = this.heatBuffer.getContext('2d');
    this.layout = null;
    this.hover = null;
    this.measurement = null;
    this.paletteCache = new Map();
    this.sphereSprites = new Map();
    this.interaction = null;
    this.cameraCenterTick = null;
    this.cameraFrameAt = 0;
    this.cameraInMotion = false;
    this.tradeClusterCache = { key: '', value: [] };
    this.fontFamilies = { mono: 'Consolas, monospace', ui: '"Arial Narrow", sans-serif' };
  }

  setHover(point) { this.hover = point; }
  setMeasurement(measurement) { this.measurement = measurement; }

  resetCamera() {
    this.cameraCenterTick = null;
    this.cameraFrameAt = 0;
    this.cameraInMotion = false;
  }

  #smoothCameraCenter(targetTick, enabled) {
    const target = Number(targetTick);
    if (!Number.isFinite(target)) return targetTick;
    if (!enabled || !Number.isFinite(this.cameraCenterTick)) {
      this.cameraCenterTick = target;
      this.cameraFrameAt = performance.now();
      this.cameraInMotion = false;
      return target;
    }

    const now = performance.now();
    const elapsed = Math.max(8, Math.min(80, now - this.cameraFrameAt || 16));
    this.cameraFrameAt = now;
    const distance = target - this.cameraCenterTick;
    if (Math.abs(distance) <= 0.025) {
      this.cameraCenterTick = target;
      this.cameraInMotion = false;
      return target;
    }

    // Exponential damping gives the price camera a quiet dolly movement while
    // remaining frame-rate independent on 60 Hz, 120 Hz and 144 Hz displays.
    const blend = 1 - Math.exp(-elapsed / 190);
    this.cameraCenterTick += distance * blend;
    this.cameraInMotion = true;
    return this.cameraCenterTick;
  }

  beginInteraction(mode) {
    if (!['pan', 'price-pan'].includes(mode) || !this.layout) return;
    this.interaction = {
      mode,
      start: this.layout.start,
      end: this.layout.end,
      centerTick: this.layout.centerTick,
      columnPixels: this.layout.columnPixels,
      startTimestamp: Number(this.layout.history?.[this.layout.start]?.timestamp || 0),
      endTimestamp: Number(this.layout.history?.[this.layout.end]?.timestamp || 0),
    };
  }

  endInteraction() {
    this.interaction = null;
  }

  #font(size, weight = 500, mono = true) {
    const family = mono ? this.fontFamilies.mono : this.fontFamilies.ui;
    return `${weight} ${size}px ${family}`;
  }

  render(history, endIndex, view, settings, config, indicatorAnalysis = null) {
    if (!history.length || endIndex < 0) return;
    const { context: ctx, width, height } = fitCanvas(this.canvas);
    const end = Math.min(history.length - 1, endIndex);
    const current = history[end];
    const accents = paletteAccents(settings.palette);
    this.chrome = canvasUiTheme(settings.uiTheme);
    const canvasStyles = getComputedStyle(this.canvas);
    this.fontFamilies = {
      mono: canvasStyles.getPropertyValue('--font-mono').trim() || 'Consolas, monospace',
      ui: canvasStyles.getPropertyValue('--font-ui').trim() || '"Arial Narrow", sans-serif',
    };
    // Keep the right rail aligned with the standard Charts workspace while
    // separating price, the live resting book, COB, execution flow and SVP.
    const domVisible = settings.domVisible !== false;
    const priceLabelWidth = width < 700 ? 70 : width < 900 ? 78 : 88;
    const defaultDomWidth = width < 700 ? 118 : width < 900 ? 138 : 158;
    const requestedDomWidth = settings.domWidth == null ? Number.NaN : Number(settings.domWidth);
    const domWidth = domVisible
      ? Math.min(260, Math.max(30, Number.isFinite(requestedDomWidth) ? requestedDomWidth : defaultDomWidth))
      : 0;
    const restingBookWidth = domVisible ? Math.round(domWidth * .66) : 0;
    const depthColumnWidth = domVisible ? domWidth - restingBookWidth : 0;
    // The toolbar DOM toggle owns the complete market ladder. When disabled,
    // collapse the price/book rail, bid/ask execution profile and SVP together
    // so the heatmap and CVD reclaim the complete right side.
    const priceAxisWidth = domVisible ? priceLabelWidth + restingBookWidth + depthColumnWidth : 0;
    const profilesVisible = domVisible && settings.profile;
    const volumeRatioWidth = profilesVisible ? (width < 700 ? 72 : width < 900 ? 92 : 112) : 0;
    const profileWidth = profilesVisible ? (width < 700 ? 72 : width < 900 ? 92 : 112) : 0;
    const timeAxisHeight = 28;
    const rightHeaderHeight = 32;
    const plotWidth = Math.max(120, width - priceAxisWidth - volumeRatioWidth - profileWidth);
    const plotHeight = Math.max(80, height - timeAxisHeight);
    const rowTicks = Math.max(1, view.aggregation || 1);
    const baseRows = Math.max(45, view.visibleRows || 112);
    const visibleTickSpan = baseRows * rowTicks;
    // Auto-centre must follow the price the user is actually watching.  The
    // inside-market midpoint can temporarily diverge from the last traded
    // price when the restored depth book is stale or still catching up.  That
    // previously put the live-price marker near an edge on some aspect ratios.
    // Resolve the unlocked centre from lastTick on every render so the price
    // always lands at the midpoint of the *current visible plot height*; retain
    // midTick only as a defensive fallback for snapshots without a trade.
    const liveTick = Number(current.lastTick);
    const targetCenterTick = view.centerTick ?? (Number.isFinite(liveTick) && liveTick > 0
      ? liveTick
      : current.midTick);
    const autoCenterLocked = settings.autoCenter
      && view.centerTick == null
      && this.interaction == null;
    // Follow the live price with a damped camera. Snapping the complete price
    // plane to every traded tick made the fixed view visibly jump. The marker
    // remains centred by Main while the heavier depth canvas quietly catches
    // up, giving the map a dolly movement instead of a staircase.
    const centerTick = autoCenterLocked
      ? this.#smoothCameraCenter(targetCenterTick, true)
      : this.#smoothCameraCenter(targetCenterTick, false);
    const bottomTick = centerTick - visibleTickSpan / 2;
    const topTick = centerTick + visibleTickSpan / 2;
    // Screen chrome must not inherit the user's drag transform. The heatmap,
    // trails and executions can move under the pointer; the DOM and profile
    // rails retain the camera position captured at pointer-down. Once the
    // interaction ends they rejoin the already-damped live camera, avoiding a
    // second, independently snapping price plane.
    const overlayCenterTick = this.interaction
      ? this.interaction.centerTick
      : centerTick;
    const overlayBottomTick = overlayCenterTick - visibleTickSpan / 2;
    const overlayTopTick = overlayCenterTick + visibleTickSpan / 2;
    const overlayYForTick = tick => ((overlayTopTick - tick) / visibleTickSpan) * plotHeight;
    // Main owns the data-aware zoom floor. Keep only a tiny renderer safety
    // floor here so it never silently overrides horizontal zoom.
    const columnPixels = Math.max(0.12, view.columnPixels || 1.25);
    const liveGap = Math.min(108, Math.max(52, plotWidth * 0.085));
    const dataWidth = plotWidth - liveGap;
    const visibleColumns = Math.max(30, Math.floor(dataWidth / columnPixels));
    const start = Math.max(0, end - visibleColumns + 1);
    const count = end - start + 1;
    const xForIndex = index => count <= 1 ? dataWidth : ((index - start) / (count - 1)) * dataWidth;
    const yForTick = tick => ((topTick - tick) / visibleTickSpan) * plotHeight;
    const tickForY = y => topTick - (y / plotHeight) * visibleTickSpan;

    this.layout = {
      width, height, plotWidth, dataWidth, liveGap, plotHeight, profileWidth, volumeRatioWidth, priceAxisWidth,
      priceLabelWidth, restingBookWidth, depthColumnWidth, timeAxisHeight,
      rightHeaderHeight, domVisible,
      domWidth,
      bottomTick, topTick, centerTick, visibleTickSpan, rowTicks, columnPixels,
      overlayBottomTick, overlayTopTick, overlayCenterTick, overlayYForTick,
      start, end, count, xForIndex, yForTick, tickForY,
      config, history,
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.chrome.axis;
    ctx.fillRect(0, 0, width, height);
    if (settings.heatmap) this.#drawHeatmap(ctx, history, start, end, current, settings);
    this.#drawGrid(ctx, history, settings);
    if (settings.trails) this.#drawInsideMarket(ctx, history, accents);
    // Viewport interaction must never change what market data is visible.
    // The heat raster itself is cached while the user drags, but executions
    // and the right-side bid/ask profiles are inexpensive overlays and must
    // stay painted. Hiding them on pointer-down made a harmless grab look like
    // the live trade feed and resting book had disappeared.
    if (settings.trades) this.#drawTrades(ctx, history, settings, accents);
    this.#drawBottomVolume(ctx, history, accents);
    if (!this.interaction) this.#drawIndicatorMarks(ctx, indicatorAnalysis, settings, accents);
    if (profilesVisible) {
      this.#drawBidAskVolumeProfile(ctx, history, accents);
      this.#drawVolumeProfile(ctx, history, accents);
    }
    if (domVisible) this.#drawPriceAxis(ctx, current, accents);
    this.#drawTimeAxis(ctx, history);
    this.#drawCrosshair(ctx);
    this.#drawMeasurement(ctx);
    if (settings.cvdEnabled && settings.cvdPanel) {
      this.#drawCvd(history, start, end, settings, accents, indicatorAnalysis);
    }
  }

  #drawHeatmap(ctx, history, start, end, current, settings) {
    const layout = this.layout;
    if (this.interaction && this.heatBuffer.width > 0 && this.heatBuffer.height > 0) {
      const horizontalOffset = (this.interaction.end - layout.end) * layout.columnPixels;
      const verticalOffset = (
        (layout.centerTick - this.interaction.centerTick)
        / Math.max(1, layout.visibleTickSpan)
      ) * layout.plotHeight;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, layout.plotWidth, layout.plotHeight);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.heatBuffer,
        0,
        0,
        this.heatBuffer.width,
        this.heatBuffer.height,
        horizontalOffset,
        verticalOffset,
        layout.dataWidth,
        layout.plotHeight,
      );
      // Continue the most recent genuine column through Bookmap's live gap.
      ctx.drawImage(
        this.heatBuffer,
        Math.max(0, this.heatBuffer.width - 1),
        0,
        1,
        this.heatBuffer.height,
        layout.dataWidth + horizontalOffset,
        verticalOffset,
        layout.liveGap,
        layout.plotHeight,
      );
      ctx.restore();
      return;
    }
    const columns = end - start + 1;
    const paletteKey = `${paletteRenderKey(settings.palette)}:${settings.heatmapDimming}`;
    const paletteChanged = this.heatPalette !== paletteKey;
    this.heatPalette = paletteKey;
    // The camera centre is deliberately sub-pixel smooth. Feeding that
    // fractional position into the heat-raster cache made every animation
    // frame a new geometry and forced all visible depth columns to be rebuilt.
    // Anchor the expensive depth raster to a stable four-row price grid; live
    // price, trades, trails and the presentation camera remain exact.
    const heatmapAnchor = Math.max(layout.rowTicks, layout.rowTicks * 4);
    const heatmapCenterTick = Math.round(layout.centerTick / heatmapAnchor) * heatmapAnchor;
    const heatmapBottomTick = heatmapCenterTick - layout.visibleTickSpan / 2;
    const heatmapTopTick = heatmapCenterTick + layout.visibleTickSpan / 2;
    const heatmapYOffset = (
      (layout.topTick - heatmapTopTick)
      / Math.max(1, layout.visibleTickSpan)
    ) * layout.plotHeight;
    const heatmap = this.depthEngine.buildHeatmap({
      start,
      end,
      bottomTick: heatmapBottomTick,
      topTick: heatmapTopTick,
      rowTicks: layout.rowTicks,
      filterType: settings.heatmapFilter,
      gaussianSigma: settings.gaussianSigma,
      rowPixels: layout.plotHeight / Math.max(1, layout.visibleTickSpan / layout.rowTicks),
      cumulative: settings.aggregateDepth,
      sensitivity: settings.sensitivity,
    });
    const rows = heatmap.height;
    const rasterRows = Math.max(rows, Math.round(layout.plotHeight));
    const resized = this.heatBuffer.width !== columns || this.heatBuffer.height !== rasterRows;
    if (resized) {
      this.heatBuffer.width = columns;
      this.heatBuffer.height = rasterRows;
      this.heatContext = this.heatBuffer.getContext('2d');
    }
    let palette = this.paletteCache.get(paletteKey);
    if (!palette) {
      palette = dimPalette(paletteLut(settings.palette), settings.heatmapDimming);
      this.paletteCache.set(paletteKey, palette);
    }

    if (!resized && heatmap.shiftColumns > 0) {
      const retained = columns - heatmap.shiftColumns;
      this.heatContext.drawImage(
        this.heatBuffer,
        heatmap.shiftColumns, 0, retained, rasterRows,
        0, 0, retained, rasterRows,
      );
    }
    if (resized || paletteChanged || heatmap.updateStart === 0) {
      this.#writeHeatmapPixels(heatmap, palette, 0, columns, rasterRows);
    } else if (heatmap.updateStart < columns) {
      this.#writeHeatmapPixels(heatmap, palette, heatmap.updateStart, columns - heatmap.updateStart, rasterRows);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, layout.plotWidth, layout.plotHeight);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(this.heatBuffer, 0, 0, columns, rasterRows, 0, heatmapYOffset, layout.dataWidth, layout.plotHeight);
    ctx.drawImage(
      this.heatBuffer,
      Math.max(0, columns - 1), 0, 1, rasterRows,
      layout.dataWidth, heatmapYOffset, layout.liveGap, layout.plotHeight,
    );
    ctx.restore();
  }

  #writeHeatmapPixels(heatmap, palette, sourceX, width, rasterRows) {
    if (width <= 0 || heatmap.height <= 0) return;
    const image = this.heatContext.createImageData(width, rasterRows);
    const pixels = image.data;
    for (let row = 0; row < rasterRows; row += 1) {
      for (let localX = 0; localX < width; localX += 1) {
        const intensity = interpolateHeatIntensity(
          heatmap.intensities,
          heatmap.width,
          heatmap.height,
          sourceX + localX,
          row,
          rasterRows,
        );
        const target = (row * width + localX) * 4;
        pixels[target] = palette[intensity * 3];
        pixels[target + 1] = palette[intensity * 3 + 1];
        pixels[target + 2] = palette[intensity * 3 + 2];
        pixels[target + 3] = 255;
      }
    }
    this.heatContext.putImageData(image, sourceX, 0);
  }

  #drawGrid(ctx, history, settings) {
    if (!settings.grid) return;
    const layout = this.layout;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${this.chrome.grid},.18)`;
    ctx.setLineDash([2, 5]);
    const verticalLines = Math.max(3, Math.floor(layout.dataWidth / 150));
    for (let index = 1; index < verticalLines; index += 1) {
      const x = Math.round((index / verticalLines) * layout.dataWidth) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, layout.plotHeight);
      ctx.stroke();
    }
    ctx.restore();
  }

  #drawInsideMarket(ctx, history, accents) {
    const layout = this.layout;
    const drawTrail = (field, color, extensionColor) => {
      ctx.save();
      const path = new Path2D();
      let started = false;
      let previousY = 0;
      for (let index = layout.start; index <= layout.end; index += 1) {
        const tick = history[index][field];
        const x = layout.xForIndex(index);
        const y = layout.yForTick(tick);
        if (!started) {
          path.moveTo(x, y);
          started = true;
        } else {
          path.lineTo(x, y);
        }
        previousY = y;
      }
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke(path);
      ctx.beginPath();
      ctx.moveTo(layout.dataWidth, previousY);
      ctx.lineTo(layout.plotWidth, previousY);
      ctx.strokeStyle = extensionColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'butt';
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.restore();
    };
    drawTrail('bestBid', colorCss(accents.bid), colorCss(accents.bid, .95));
    drawTrail('bestAsk', colorCss(accents.ask), colorCss(accents.ask, .95));
  }

  #drawTrades(ctx, history, settings, accents) {
    const layout = this.layout;
    const clusterOptions = {
      start: layout.start,
      end: layout.end,
      rowTicks: layout.rowTicks,
      rowPixels: layout.plotHeight / Math.max(1, layout.visibleTickSpan / layout.rowTicks),
      columnPixels: layout.columnPixels,
      circleSize: settings.circleSize,
      circleTransparency: settings.circleTransparency,
      smartClustering: settings.smartClustering,
      differential: settings.bubbleDifferential,
      minimumTradeSize: settings.minimumTradeSize,
      minimumPixelVolume: settings.minimumPixelVolume,
    };
    const clusterKey = [
      this.depthEngine.revision,
      clusterOptions.start,
      clusterOptions.end,
      clusterOptions.rowTicks,
      clusterOptions.rowPixels.toFixed(3),
      clusterOptions.columnPixels.toFixed(3),
      clusterOptions.circleSize,
      clusterOptions.circleTransparency,
      clusterOptions.smartClustering,
      clusterOptions.differential,
      clusterOptions.minimumTradeSize,
      clusterOptions.minimumPixelVolume,
    ].join('|');
    if (this.tradeClusterCache.key !== clusterKey) {
      this.tradeClusterCache = {
        key: clusterKey,
        value: this.depthEngine.clusterTrades(clusterOptions),
      };
    }
    const clusters = this.tradeClusterCache.value;
    ctx.save();
    for (const cluster of clusters) {
      const x = layout.xForIndex(cluster.index);
      const y = layout.yForTick(cluster.tick);
      if (y < -22 || y > layout.plotHeight + 22) continue;
      this.#drawSphereDot(ctx, x, y, cluster, accents);
    }
    ctx.restore();
  }

  #drawIndicatorMarks(ctx, analysis, settings, accents) {
    if (!analysis) return;
    const layout = this.layout;
    const candidates = [
      ...(settings.absorptionEnabled ? analysis.absorptionEvents || [] : []),
      ...(settings.sweepsEnabled ? analysis.sweepEvents || [] : []),
    ].filter(event => (
      event.frameIndex >= layout.start
      && event.frameIndex <= layout.end
      && event.tick >= layout.bottomTick
      && event.tick <= layout.topTick
    ));
    const aggregated = new Map();
    for (const event of candidates) {
      const x = layout.xForIndex(event.frameIndex);
      const y = layout.yForTick(event.tick);
      const key = `${event.type}:${Math.round(x / 20)}:${Math.round(y / 15)}`;
      const previous = aggregated.get(key);
      if (!previous || event.volume > previous.volume) aggregated.set(key, event);
    }

    ctx.save();
    ctx.font = this.#font(8, 700, false);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const event of aggregated.values()) {
      const x = layout.xForIndex(event.frameIndex);
      const y = layout.yForTick(event.tick);
      const color = event.type === 'absorption'
        ? (event.bookSide === 'bid' ? accents.bid : accents.ask)
        : (event.aggressiveSide === 'buy' ? accents.bid : accents.ask);
      const stroke = colorCss(color, .96);
      const fill = colorCss(color, .82);
      if (event.type === 'absorption') {
        const direction = event.bookSide === 'bid' ? 1 : -1;
        const markerY = Math.max(11, Math.min(layout.plotHeight - 11, y + direction * 17));
        const volume = Math.round(event.volume).toLocaleString();
        const width = Math.max(24, 13 + volume.length * 5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, markerY - direction * 7);
        ctx.strokeStyle = colorCss(color, .72);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `${this.chrome.axis}ee`;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(x - width / 2, markerY - 7, width, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.fillText(`A ${volume}`, x, markerY + .5);
      } else {
        const radius = 7;
        ctx.fillStyle = `${this.chrome.axis}e6`;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y);
        ctx.lineTo(x, y + radius);
        ctx.lineTo(x - radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.fillText('S', x, y + .5);
      }
    }
    ctx.restore();
  }

  #sphereSprite(color) {
    const key = color.join(':');
    if (this.sphereSprites.has(key)) return this.sphereSprites.get(key);
    const diameter = 200;
    const radius = diameter / 2;
    const sprite = document.createElement('canvas');
    sprite.width = diameter;
    sprite.height = diameter;
    const spriteContext = sprite.getContext('2d');
    const image = spriteContext.createImageData(diameter, diameter);
    for (let x = 0; x < diameter; x += 1) {
      const normalX = (x - radius) / radius;
      for (let y = 0; y < diameter; y += 1) {
        const normalY = (y - radius) / radius;
        const distance = Math.sqrt(normalX * normalX + normalY * normalY);
        if (distance > 1) continue;
        const normalZ = Math.sqrt(1 - distance * distance);
        let light = Math.max(normalX * 0.6 + normalZ * 0.8, 0);
        light = Math.pow(light, 0.7);
        const intensity = Math.sqrt(light * light * 0.98 + 0.02);
        const offset = (y * diameter + x) * 4;
        image.data[offset] = color[0] * intensity;
        image.data[offset + 1] = color[1] * intensity;
        image.data[offset + 2] = color[2] * intensity;
        // The user's transparency control is applied once when the cluster is
        // drawn. Baking a second 75% alpha into the sphere made even the zero
        // transparency position look washed out. Keep the sphere itself fully
        // opaque so slider-left produces solid bid/ask balls.
        image.data[offset + 3] = 255;
      }
    }
    spriteContext.putImageData(image, 0, 0);
    this.sphereSprites.set(key, sprite);
    return sprite;
  }

  #drawClippedSphere(ctx, sprite, x, y, diameter, points) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sprite, x, y, diameter, diameter);
    ctx.restore();
  }

  #drawSphereDot(ctx, centerX, centerY, cluster, accents) {
    const diameter = Math.max(1, Math.round(cluster.diameter));
    const radius = diameter / 2;
    const buy = this.#sphereSprite(accents.bid);
    const sell = this.#sphereSprite(accents.ask);
    const ratio = cluster.buyRatio;
    ctx.save();
    ctx.globalAlpha = cluster.alpha / 255;
    ctx.imageSmoothingEnabled = true;
    if (ratio <= 0.01) {
      ctx.drawImage(sell, centerX - radius, centerY - radius, diameter, diameter);
      ctx.restore();
      return;
    }
    if (ratio >= 0.99) {
      ctx.drawImage(buy, centerX - radius, centerY - radius, diameter, diameter);
      ctx.restore();
      return;
    }

    const verticalOffset = ratio > 0.45 && ratio < 0.55 ? 1 : 2;
    const x = centerX - radius;
    const y = centerY - radius + verticalOffset;
    const left = x;
    const right = x + diameter;
    const top = y;
    const bottom = y + diameter;
    const center = [x + diameter / 2, y + diameter / 2];
    if (ratio <= 0.25) {
      const width = ratio * diameter / 0.25;
      const start = [center[0] - width / 2, top];
      const end = [center[0] + width / 2, top];
      this.#drawClippedSphere(ctx, buy, x, y, diameter, [start, center, end]);
      this.#drawClippedSphere(ctx, sell, x, y, diameter, [
        start, [left, top], [left, bottom], [right, bottom], [right, top], end, center,
      ]);
    } else if (ratio <= 0.75) {
      const splitY = y + (ratio - 0.25) * diameter / 0.5;
      const start = [left, splitY];
      const end = [right, splitY];
      this.#drawClippedSphere(ctx, buy, x, y, diameter, [start, [left, top], [right, top], end, center]);
      this.#drawClippedSphere(ctx, sell, x, y, diameter, [start, [left, bottom], [right, bottom], end, center]);
    } else {
      const width = (ratio - 0.75) * diameter / 0.25;
      const start = [center[0] - width / 2, bottom];
      const end = [center[0] + width / 2, bottom];
      this.#drawClippedSphere(ctx, buy, x, y, diameter, [
        start, [left, bottom], [left, top], [right, top], [right, bottom], end, center,
      ]);
      this.#drawClippedSphere(ctx, sell, x, y, diameter, [start, end, center]);
    }
    ctx.restore();
  }

  #drawBottomVolume(ctx, history, accents) {
    const layout = this.layout;
    const bandHeight = Math.max(42, Math.min(82, layout.plotHeight * 0.12));
    let maximum = 1;
    for (let index = layout.start; index <= layout.end; index += 1) {
      maximum = Math.max(maximum, history[index].volume);
    }
    const barWidth = Math.max(1, layout.dataWidth / Math.max(1, layout.count));
    ctx.save();
    ctx.fillStyle = `${this.chrome.axis}99`;
    ctx.fillRect(0, layout.plotHeight - bandHeight, layout.plotWidth, bandHeight);
    for (let index = layout.start; index <= layout.end; index += 1) {
      const frame = history[index];
      const height = frame.volume / maximum * (bandHeight - 5);
      const x = layout.xForIndex(index) - barWidth / 2;
      // Use the exact execution palette as the trade bubbles: positive delta
      // is buyer/ask-side aggression and negative delta is seller/bid-side.
      // This also keeps both visuals synchronized when the website theme changes.
      ctx.fillStyle = frame.delta >= 0
        ? colorCss(accents.bid, .78)
        : colorCss(accents.ask, .78);
      ctx.fillRect(x, layout.plotHeight - height, Math.max(1, barWidth - .4), height);
    }
    ctx.restore();
  }

  #priceAxisStep() {
    const layout = this.layout;
    return Math.max(layout.rowTicks, Math.round(layout.visibleTickSpan / Math.max(12, layout.plotHeight / 25)));
  }

  #drawBidAskVolumeProfile(ctx, history, accents) {
    const layout = this.layout;
    const x0 = layout.plotWidth + layout.priceAxisWidth;
    const width = layout.volumeRatioWidth;
    const midpoint = x0 + width / 2;
    const headerHeight = layout.rightHeaderHeight;
    const step = this.#priceAxisStep();
    const firstTick = Math.ceil(layout.overlayBottomTick / step) * step;
    const profile = new Map();

    for (let index = layout.start; index <= layout.end; index += 1) {
      for (const trade of history[index].trades) {
        if (trade.tick < layout.overlayBottomTick || trade.tick > layout.overlayTopTick) continue;
        const bucket = Math.round(trade.tick / step) * step;
        const value = profile.get(bucket) || { buy: 0, sell: 0 };
        value[trade.side] += trade.size;
        profile.set(bucket, value);
      }
    }

    ctx.save();
    ctx.fillStyle = this.chrome.axisAlt;
    ctx.fillRect(x0, 0, width, layout.plotHeight);
    ctx.strokeStyle = `rgba(${this.chrome.grid},.3)`;
    ctx.beginPath();
    ctx.moveTo(x0 + .5, 0);
    ctx.lineTo(x0 + .5, layout.plotHeight);
    ctx.moveTo(midpoint + .5, 0);
    ctx.lineTo(midpoint + .5, layout.plotHeight);
    ctx.stroke();

    const levelSpacing = layout.plotHeight / Math.max(1, layout.visibleTickSpan / step);
    const barHeight = Math.max(12, Math.min(18, levelSpacing * .68));
    const halfWidth = Math.max(1, width / 2 - 5);
    // Executions at the bid are aggressive sells; executions at the ask are
    // aggressive buys. Keep that market-side definition explicit here.
    const bidColor = accents.ask;
    const askColor = accents.bid;
    ctx.font = this.#font(9, 600, true);
    ctx.textBaseline = 'middle';

    for (let tick = firstTick; tick <= layout.overlayTopTick; tick += step) {
      const y = layout.overlayYForTick(tick);
      if (y < headerHeight + 8 || y > layout.plotHeight - 8) continue;
      const value = profile.get(tick);
      if (!value) continue;
      const percentages = bidAskVolumePercentages(value.buy, value.sell);
      if (percentages.total <= 0) continue;

      ctx.fillStyle = `rgba(${this.chrome.grid},.16)`;
      ctx.fillRect(x0 + 4, y - barHeight / 2, halfWidth, barHeight);
      ctx.fillRect(midpoint + 1, y - barHeight / 2, halfWidth, barHeight);
      ctx.fillStyle = colorCss(bidColor, .34);
      ctx.fillRect(midpoint - percentages.bid / 100 * halfWidth, y - barHeight / 2, percentages.bid / 100 * halfWidth, barHeight);
      ctx.fillStyle = colorCss(askColor, .34);
      ctx.fillRect(midpoint + 1, y - barHeight / 2, percentages.ask / 100 * halfWidth, barHeight);

      ctx.textAlign = 'center';
      ctx.fillStyle = colorCss(bidColor);
      ctx.fillText(`${percentages.bid}%`, x0 + width * .25, y + .5);
      ctx.fillStyle = colorCss(askColor);
      ctx.fillText(`${percentages.ask}%`, x0 + width * .75, y + .5);
    }

    ctx.fillStyle = this.chrome.axisAlt;
    ctx.fillRect(x0, 0, width, headerHeight);
    ctx.strokeStyle = `rgba(${this.chrome.grid},1)`;
    ctx.beginPath();
    ctx.moveTo(x0, headerHeight + .5);
    ctx.lineTo(x0 + width, headerHeight + .5);
    ctx.stroke();
    ctx.fillStyle = this.chrome.muted;
    ctx.font = this.#font(9, 500, false);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('BID %', x0 + width * .25, headerHeight / 2 + .5);
    ctx.fillText('ASK %', x0 + width * .75, headerHeight / 2 + .5);
    ctx.restore();
  }

  #drawVolumeProfile(ctx, history, accents) {
    const layout = this.layout;
    const x0 = layout.plotWidth + layout.priceAxisWidth + layout.volumeRatioWidth;
    const headerHeight = layout.rightHeaderHeight;
    const profile = new Map();
    let maximum = 1;
    for (let index = layout.start; index <= layout.end; index += 1) {
      for (const trade of history[index].trades) {
        if (trade.tick < layout.overlayBottomTick || trade.tick > layout.overlayTopTick) continue;
        const bucket = Math.floor(trade.tick / layout.rowTicks) * layout.rowTicks;
        const value = profile.get(bucket) || { buy: 0, sell: 0 };
        value[trade.side] += trade.size;
        profile.set(bucket, value);
        maximum = Math.max(maximum, value.buy + value.sell);
      }
    }
    ctx.save();
    ctx.fillStyle = this.chrome.axisAlt;
    ctx.fillRect(x0, 0, layout.profileWidth, layout.plotHeight);
    ctx.strokeStyle = `rgba(${this.chrome.grid},.13)`;
    ctx.beginPath();
    ctx.moveTo(x0 + .5, 0);
    ctx.lineTo(x0 + .5, layout.plotHeight);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, headerHeight, layout.profileWidth, Math.max(0, layout.plotHeight - headerHeight));
    ctx.clip();
    const rowHeight = Math.max(1, layout.plotHeight / (layout.visibleTickSpan / layout.rowTicks));
    const midpoint = x0 + layout.profileWidth / 2;
    const halfWidth = Math.max(1, layout.profileWidth / 2 - 5);
    for (const [tick, value] of profile) {
      const y = layout.overlayYForTick(tick + layout.rowTicks / 2) - rowHeight / 2;
      const buyWidth = value.buy / maximum * halfWidth;
      const sellWidth = value.sell / maximum * halfWidth;
      ctx.fillStyle = colorCss(accents.bid, .92);
      ctx.fillRect(midpoint, y, buyWidth, Math.max(1, rowHeight - .5));
      ctx.fillStyle = colorCss(accents.ask, .9);
      ctx.fillRect(midpoint - sellWidth, y, sellWidth, Math.max(1, rowHeight - .5));
    }
    ctx.strokeStyle = `rgba(${this.chrome.grid},.2)`;
    ctx.beginPath(); ctx.moveTo(midpoint + .5, 0); ctx.lineTo(midpoint + .5, layout.plotHeight); ctx.stroke();
    ctx.restore();

    // Match the standard Watchlist column header instead of placing a label
    // over live profile data.
    ctx.fillStyle = this.chrome.axisAlt;
    ctx.fillRect(x0, 0, layout.profileWidth, headerHeight);
    ctx.strokeStyle = `rgba(${this.chrome.grid},1)`;
    ctx.beginPath();
    ctx.moveTo(x0, headerHeight + .5);
    ctx.lineTo(x0 + layout.profileWidth, headerHeight + .5);
    ctx.stroke();
    ctx.fillStyle = this.chrome.muted;
    ctx.font = this.#font(10, 500, false);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SVP', midpoint, headerHeight / 2 + .5);
    ctx.restore();
  }

  #drawPriceAxis(ctx, current, accents) {
    const layout = this.layout;
    const x0 = layout.plotWidth;
    const axisRight = x0 + layout.priceAxisWidth;
    const headerHeight = layout.rightHeaderHeight;
    const priceColumnRight = x0 + layout.priceLabelWidth;
    const bookLeft = priceColumnRight;
    const bookRight = bookLeft + layout.restingBookWidth;
    const bookMidpoint = bookLeft + layout.restingBookWidth / 2;
    const depthColumnLeft = bookRight;
    ctx.save();
    ctx.fillStyle = this.chrome.axisAlt;
    ctx.fillRect(x0, 0, layout.priceAxisWidth, layout.plotHeight);
    if (layout.domVisible) {
      ctx.fillStyle = `rgba(${this.chrome.grid},.72)`;
      ctx.fillRect(x0, 0, 1, layout.plotHeight);
      const gripY = Math.max(headerHeight + 18, Math.min(layout.plotHeight - 30, layout.plotHeight * .48));
      ctx.fillStyle = this.chrome.axisAlt;
      ctx.strokeStyle = `rgba(${this.chrome.grid},.9)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x0 - 4.5, gripY - 15, 9, 30, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = this.chrome.muted;
      for (const offset of [-5, 0, 5]) ctx.fillRect(x0 - 1, gripY + offset - .5, 2, 1);
    }
    ctx.strokeStyle = `rgba(${this.chrome.grid},.2)`;
    ctx.beginPath();
    for (const x of [x0, priceColumnRight, bookMidpoint, depthColumnLeft]) {
      ctx.moveTo(Math.round(x) + .5, 0);
      ctx.lineTo(Math.round(x) + .5, layout.plotHeight);
    }
    ctx.stroke();
    const step = this.#priceAxisStep();
    const firstTick = Math.ceil(layout.overlayBottomTick / step) * step;
    const restingBook = aggregateRestingBook(
      current.bids,
      current.asks,
      step,
      layout.overlayBottomTick,
      layout.overlayTopTick,
    );
    const levelSpacing = layout.plotHeight / Math.max(1, layout.visibleTickSpan / step);
    const bookBarHeight = Math.max(8, Math.min(16, levelSpacing * .62));
    const bookHalfWidth = Math.max(1, layout.restingBookWidth / 2 - 4);
    const bookScale = Math.max(1, restingBook.maximum);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bookLeft + 1, headerHeight, Math.max(0, layout.restingBookWidth - 2), Math.max(0, layout.plotHeight - headerHeight));
    ctx.clip();
    ctx.font = this.#font(8, 600, true);
    ctx.textBaseline = 'middle';
    for (let tick = firstTick; tick <= layout.overlayTopTick; tick += step) {
      const y = layout.overlayYForTick(tick);
      if (y < headerHeight + 8 || y > layout.plotHeight - 8) continue;
      const value = restingBook.bands.get(tick);
      if (!value) continue;
      const sellWidth = value.sell / bookScale * bookHalfWidth;
      const buyWidth = value.buy / bookScale * bookHalfWidth;
      if (sellWidth > 0) {
        ctx.fillStyle = colorCss(accents.ask, .56);
        ctx.fillRect(bookMidpoint - sellWidth, y - bookBarHeight / 2, sellWidth, bookBarHeight);
      }
      if (buyWidth > 0) {
        ctx.fillStyle = colorCss(accents.bid, .56);
        ctx.fillRect(bookMidpoint + 1, y - bookBarHeight / 2, buyWidth, bookBarHeight);
      }
      if (layout.restingBookWidth >= 84) {
        if (value.sell > 0) {
          ctx.textAlign = 'left';
          ctx.fillStyle = colorCss(accents.ask);
          ctx.fillText(String(Math.round(value.sell)), bookLeft + 3, y + .5);
        }
        if (value.buy > 0) {
          ctx.textAlign = 'right';
          ctx.fillStyle = colorCss(accents.bid);
          ctx.fillText(String(Math.round(value.buy)), bookRight - 3, y + .5);
        }
      }
    }
    ctx.restore();

    ctx.font = this.#font(11, 400, true);
    ctx.textBaseline = 'middle';
    for (let tick = firstTick; tick <= layout.overlayTopTick; tick += step) {
      const y = layout.overlayYForTick(tick);
      if (y < headerHeight + 8 || y > layout.plotHeight - 8) continue;
      const roundedTick = Math.round(tick);
      const bid = current.bids.get(roundedTick) || 0;
      const ask = current.asks.get(roundedTick) || 0;
      const size = bid || ask;
      if (size && layout.domVisible) {
        const barWidth = Math.min(layout.depthColumnWidth, Math.log1p(size) * 7);
        ctx.fillStyle = colorCss(bid ? accents.bid : accents.ask, bid ? .2 : .22);
        ctx.fillRect(axisRight - barWidth, y - 8, barWidth, 16);
      }
      ctx.strokeStyle = `rgba(${this.chrome.grid},.18)`;
      ctx.beginPath();
      ctx.moveTo(x0, Math.round(y) + .5);
      ctx.lineTo(x0 + 4, Math.round(y) + .5);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = this.chrome.text;
      ctx.fillText(priceLabel(tick, layout.config), x0 + 10, y);
      if (size && layout.domVisible) {
        ctx.textAlign = 'right';
        ctx.fillStyle = colorCss(bid ? accents.bid : accents.ask);
        ctx.fillText(Math.round(size), axisRight - 8, y);
      }
    }
    const bestBidY = layout.overlayYForTick(current.bestBid);
    const bestAskY = layout.overlayYForTick(current.bestAsk);
    ctx.font = this.#font(11, 600, true);
    ctx.textBaseline = 'middle';
    for (const [tick, y, fill, textFill, size] of [
      [current.bestAsk, bestAskY, colorCss(accents.ask), '#fafafa', current.asks.get(Math.round(current.bestAsk)) || 0],
      [current.bestBid, bestBidY, colorCss(accents.bid), '#09090b', current.bids.get(Math.round(current.bestBid)) || 0],
    ]) {
      if (y < headerHeight || y > layout.plotHeight) continue;
      ctx.fillStyle = fill;
      ctx.globalAlpha = .86;
      ctx.fillRect(x0 + 1, y - 8, layout.priceLabelWidth - 1, 16);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.fillStyle = textFill;
      ctx.fillText(priceLabel(tick, layout.config), x0 + 10, y);
      if (size && layout.domVisible) {
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(size), axisRight - 8, y);
      }
    }

    ctx.fillStyle = this.chrome.axisAlt;
    ctx.fillRect(x0, 0, layout.priceAxisWidth, headerHeight);
    ctx.strokeStyle = `rgba(${this.chrome.grid},1)`;
    ctx.beginPath();
    ctx.moveTo(x0, headerHeight + .5);
    ctx.lineTo(axisRight, headerHeight + .5);
    for (const x of [priceColumnRight, bookMidpoint, depthColumnLeft]) {
      ctx.moveTo(Math.round(x) + .5, 0);
      ctx.lineTo(Math.round(x) + .5, headerHeight);
    }
    ctx.stroke();
    ctx.font = this.#font(10, 500, false);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.chrome.muted;
    ctx.fillText('PRICE', x0 + 10, headerHeight / 2 + .5);
    if (layout.domVisible) {
      if (layout.restingBookWidth >= 56) {
        ctx.font = this.#font(9, 600, false);
        ctx.textAlign = 'center';
        ctx.fillStyle = colorCss(accents.ask);
        ctx.fillText('SELL', bookLeft + layout.restingBookWidth * .25, headerHeight / 2 + .5);
        ctx.fillStyle = colorCss(accents.bid);
        ctx.fillText('BUY', bookLeft + layout.restingBookWidth * .75, headerHeight / 2 + .5);
      }
      if (layout.depthColumnWidth >= 28) {
        ctx.font = this.#font(10, 500, false);
        ctx.textAlign = 'right';
        ctx.fillStyle = this.chrome.muted;
        ctx.fillText('COB', axisRight - 8, headerHeight / 2 + .5);
      }
    }
    ctx.restore();
  }

  #drawTimeAxis(ctx, history) {
    const layout = this.layout;
    const y0 = layout.plotHeight;
    ctx.save();
    ctx.fillStyle = this.chrome.axis;
    ctx.fillRect(0, y0, layout.width, layout.timeAxisHeight);
    ctx.strokeStyle = `rgba(${this.chrome.grid},.2)`;
    ctx.beginPath();
    ctx.moveTo(0, y0 + .5);
    ctx.lineTo(layout.width, y0 + .5);
    ctx.stroke();
    ctx.fillStyle = this.chrome.text;
    ctx.font = this.#font(11, 400, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = Math.max(2, Math.floor(layout.dataWidth / 160));
    for (let label = 0; label <= labels; label += 1) {
      const fraction = label / labels;
      const x = Math.min(layout.dataWidth - 28, Math.max(28, fraction * layout.dataWidth));
      const fixedStart = Number(this.interaction?.startTimestamp || 0);
      const fixedEnd = Number(this.interaction?.endTimestamp || 0);
      const index = Math.min(layout.end, layout.start + Math.round((layout.count - 1) * fraction));
      const timestamp = fixedStart > 0 && fixedEnd >= fixedStart
        ? fixedStart + (fixedEnd - fixedStart) * fraction
        : history[index].timestamp;
      ctx.strokeStyle = `rgba(${this.chrome.grid},1)`;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + .5, y0);
      ctx.lineTo(Math.round(x) + .5, y0 + 4);
      ctx.stroke();
      ctx.fillStyle = this.chrome.text;
      ctx.fillText(timeLabel(timestamp), x, y0 + layout.timeAxisHeight / 2 + 2);
    }
    ctx.restore();
  }

  #drawCrosshair(ctx) {
    const layout = this.layout;
    const point = this.hover;
    if (!point || point.x < 0 || point.y < 0 || point.x > layout.plotWidth || point.y > layout.plotHeight) return;
    ctx.save();
    ctx.strokeStyle = `rgba(${this.chrome.grid},.42)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(Math.round(point.x) + .5, 0);
    ctx.lineTo(Math.round(point.x) + .5, layout.plotHeight);
    ctx.moveTo(0, Math.round(point.y) + .5);
    ctx.lineTo(layout.width, Math.round(point.y) + .5);
    ctx.stroke();
    ctx.restore();
  }

  #drawMeasurement(ctx) {
    const layout = this.layout;
    const measurement = this.measurement;
    if (!measurement?.start || !measurement?.end) return;
    const { start, end } = measurement;
    ctx.save();
    ctx.strokeStyle = `rgba(${this.chrome.grid},.85)`;
    ctx.fillStyle = `rgba(${this.chrome.grid},.06)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.fillRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }

  #drawCvd(history, start, end, settings, accents, analysis) {
    const { context: ctx, width, height } = fitCanvas(this.cvdCanvas);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.chrome.axis;
    ctx.fillRect(0, 0, width, height);
    const currentTimestamp = Number(history[end]?.timestamp || Number.POSITIVE_INFINITY);
    const visibleStartTimestamp = Number(history[start]?.timestamp || 0);
    const sessionPoints = analysis?.sessionCvd?.points || [];
    const sessionEnd = timestampUpperBound(sessionPoints, currentTimestamp);
    const firstVisibleIndex = timestampLowerBound(sessionPoints, visibleStartTimestamp, sessionEnd);
    const continuityIndex = firstVisibleIndex > 0 ? firstVisibleIndex - 1 : firstVisibleIndex;
    let points = sessionPoints.slice(Math.max(0, continuityIndex), sessionEnd);
    let baseline = { value: 0, buy: 0, sell: 0 };
    if (sessionEnd > 0) {
      if (!points.length) points = sessionPoints.slice(Math.max(0, sessionEnd - 2), sessionEnd);
      // "Visible" rebases the value at the left edge. "Loaded" retains the
      // true session cumulative value while still drawing only the same time
      // window as the liquidity map, which makes price/CVD divergence legible.
      if (settings.cvdRange === 'visible' && continuityIndex >= 0) {
        baseline = sessionPoints[continuityIndex] || baseline;
      }
    }
    // A cold gateway may not yet have compact session buckets. Retain the
    // short in-memory calculation as a truthful fallback, never as the normal
    // loaded-history source.
    if (points.length < 2) {
      const fallback = analysis?.cvd?.points || [];
      points = fallback.slice(Math.max(0, settings.cvdRange === 'visible' ? start : 0), end + 1);
      baseline = settings.cvdRange === 'visible' && start > 0
        ? fallback[start - 1] || baseline
        : { value: 0, buy: 0, sell: 0 };
    }
    const count = points.length;
    if (count <= 1 || width <= 0 || height <= 0) return;
    const dataWidth = width;
    const plotWidth = width;
    const displayStyle = ['candles', 'line', 'bars'].includes(settings.cvdDisplayStyle)
      ? settings.cvdDisplayStyle
      : 'candles';
    const adjustedPoints = points.map(point => ({
        value: Number(point.value ?? point.close ?? 0) - Number(baseline.value || 0),
        open: Number(point.open ?? point.value ?? 0) - Number(baseline.value || 0),
        high: Number(point.high ?? point.value ?? 0) - Number(baseline.value || 0),
        low: Number(point.low ?? point.value ?? 0) - Number(baseline.value || 0),
        close: Number(point.close ?? point.value ?? 0) - Number(baseline.value || 0),
        buy: Number(point.buy || 0) - Number(baseline.buy || 0),
        sell: Number(point.sell || 0) - Number(baseline.sell || 0),
      }));
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
      const point = adjustedPoints[index];
      minimum = Math.min(minimum, point.value, point.high, point.low);
      maximum = Math.max(maximum, point.value, point.high, point.low);
      if (settings.cvdSplit) {
        minimum = Math.min(minimum, point.buy, point.sell);
        maximum = Math.max(maximum, point.buy, point.sell);
      }
    }
    if (settings.cvdScale === 'include-zero') {
      minimum = Math.min(0, minimum);
      maximum = Math.max(0, maximum);
    } else if (settings.cvdScale === 'symmetric') {
      const extent = Math.max(1, Math.abs(minimum), Math.abs(maximum));
      minimum = -extent;
      maximum = extent;
    }
    const padding = Math.max(1, (maximum - minimum) * .1);
    minimum -= padding;
    maximum += padding;
    const xForTimestamp = timestamp => {
      const target = Number(timestamp);
      if (target <= Number(history[start]?.timestamp || 0)) return 0;
      if (target >= Number(history[end]?.timestamp || 0)) return dataWidth;
      let low = start;
      let high = end;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (Number(history[middle]?.timestamp || 0) <= target) low = middle;
        else high = middle;
      }
      const leftTime = Number(history[low]?.timestamp || target);
      const rightTime = Number(history[high]?.timestamp || leftTime);
      const fraction = rightTime > leftTime ? (target - leftTime) / (rightTime - leftTime) : 0;
      return this.layout.xForIndex(low)
        + (this.layout.xForIndex(high) - this.layout.xForIndex(low)) * Math.max(0, Math.min(1, fraction));
    };
    const yForValue = value => height - 7 - ((value - minimum) / Math.max(1, maximum - minimum)) * (height - 14);
    ctx.strokeStyle = `rgba(${this.chrome.grid},.12)`;
    ctx.lineWidth = 1;
    for (let line = 1; line < 4; line += 1) {
      const y = (line / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + .5);
      ctx.lineTo(plotWidth, Math.round(y) + .5);
      ctx.stroke();
    }
    if (minimum <= 0 && maximum >= 0) {
      const zeroY = Math.round(yForValue(0)) + .5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(plotWidth, zeroY);
      ctx.strokeStyle = `rgba(${this.chrome.grid},.3)`;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const lastValue = adjustedPoints[count - 1].value;
    const firstValue = adjustedPoints[0].value;
    const drawSeries = (field, color, widthValue, shadow = 0) => {
      ctx.beginPath();
      for (let index = 0; index < count; index += 1) {
        const x = xForTimestamp(points[index]?.timestamp);
        const y = yForValue(adjustedPoints[index][field]);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = widthValue;
      ctx.shadowColor = color;
      ctx.shadowBlur = shadow;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    if (displayStyle === 'candles') {
      const barWidth = Math.max(2, Math.min(10, dataWidth / Math.max(1, count) * .64));
      for (let index = 0; index < count; index += 1) {
        const point = adjustedPoints[index];
        const x = xForTimestamp(points[index]?.timestamp);
        const positive = point.close >= point.open;
        const color = colorCss(positive ? accents.bid : accents.ask);
        const openY = yForValue(point.open);
        const closeY = yForValue(point.close);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yForValue(point.high));
        ctx.lineTo(x, yForValue(point.low));
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth / 2, Math.min(openY, closeY), barWidth, Math.max(2, Math.abs(openY - closeY)));
      }
    } else if (displayStyle === 'bars') {
      const zero = Math.max(7, Math.min(height - 7, yForValue(0)));
      const barWidth = Math.max(1, Math.min(12, dataWidth / Math.max(1, count) * .72));
      for (let index = 0; index < count; index += 1) {
        const point = adjustedPoints[index];
        const x = xForTimestamp(points[index]?.timestamp);
        const y = yForValue(point.value);
        ctx.fillStyle = colorCss(point.value >= 0 ? accents.bid : accents.ask, .9);
        ctx.fillRect(x - barWidth / 2, Math.min(y, zero), barWidth, Math.max(1, Math.abs(zero - y)));
      }
    } else {
      if (settings.cvdSplit) {
        drawSeries('buy', colorCss(accents.bid, .82), 1);
        drawSeries('sell', colorCss(accents.ask, .82), 1);
      }
      drawSeries('value', lastValue >= firstValue ? colorCss(accents.bid) : colorCss(accents.ask), 1.5, 4);
    }
    ctx.fillStyle = this.chrome.muted;
    ctx.font = this.#font(7, 500, true);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.round(maximum).toLocaleString(), plotWidth - 5, 4);
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(minimum).toLocaleString(), plotWidth - 5, height - 4);
  }

  hitTest(x, y) {
    const layout = this.layout;
    if (!layout || x < 0 || y < 0 || x > layout.plotWidth || y > layout.plotHeight) return null;
    const fraction = layout.plotWidth <= 0 ? 0 : x / layout.plotWidth;
    const index = Math.max(layout.start, Math.min(layout.end, Math.round(layout.start + fraction * (layout.count - 1))));
    const tick = Math.round(layout.tickForY(y));
    const snapshot = layout.history[index];
    const liquidity = snapshot.bids.get(tick) || snapshot.asks.get(tick) || 0;
    const executed = snapshot.trades.filter(trade => trade.tick === tick).reduce((sum, trade) => sum + trade.size, 0);
    const side = snapshot.bids.has(tick) ? 'Bid' : snapshot.asks.has(tick) ? 'Ask' : 'Inside spread';
    return {
      index,
      tick,
      price: priceLabel(tick, layout.config),
      timestamp: snapshot.timestamp,
      time: timeLabel(snapshot.timestamp, true),
      liquidity,
      executed,
      side,
      snapshot,
    };
  }

  currentPriceY(tick) {
    if (!this.layout) return 0;
    return Math.max(10, Math.min(this.layout.plotHeight - 10, this.layout.yForTick(tick)));
  }

  measurementSummary(start, end) {
    const layout = this.layout;
    if (!layout) return null;
    const startHit = this.hitTest(start.x, start.y);
    const endHit = this.hitTest(end.x, end.y);
    if (!startHit || !endHit) return null;
    const tickDelta = endHit.tick - startHit.tick;
    const elapsed = Math.abs(endHit.timestamp - startHit.timestamp);
    return {
      ticks: tickDelta,
      price: tickDelta * layout.config.tickSize,
      elapsed,
      text: `${tickDelta >= 0 ? '+' : ''}${tickDelta} ticks · ${(elapsed / 1000).toFixed(1)}s`,
    };
  }
}

export { priceLabel, timeLabel };
