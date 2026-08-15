import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, Logical, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { TpoIndicatorSettings, TpoProfileModel } from "@/lib/tpo/types";
import { tickToPrice } from "@/lib/tpo/types";

export type TpoTheme = {
  background: string;
  foreground: string;
  muted: string;
  profile: string;
  bullish: string;
  bearish: string;
  poc: string;
  valueArea: string;
  singlePrint: string;
  peak: string;
  valley: string;
  selection: string;
};

export type TpoPrimitiveModel = {
  instanceId: string;
  profile: TpoProfileModel;
  settings: TpoIndicatorSettings;
  theme: TpoTheme;
  lastCandleTime: number | null;
  intervalSeconds: number | null;
  selected?: boolean;
  mergeEligible?: boolean;
};

export type TpoHit = { instanceId: string; profileId: string; x: number; y: number };

type HitBounds = TpoHit & { left: number; right: number; top: number; bottom: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class TpoProfilePrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private models: TpoPrimitiveModel[] = [];
  private hits: HitBounds[] = [];
  private readonly paneView = {
    // TPO is the primary auction visual. Keep it above the candle series for
    // every profile and every saved setting so candles can never obscure its
    // blocks, letters or levels after hydration or a live model update.
    zOrder: () => "top" as const,
    renderer: () => ({ draw: (target: CanvasRenderingTarget2D) => this.draw(target) }),
  };

  attached(params: SeriesAttachedParameter<Time>) {
    this.attachedParams = params;
  }

  detached() {
    this.attachedParams = null;
    this.hits = [];
  }

  paneViews() {
    return [this.paneView];
  }

  updateAllViews() {}

  setModels(models: TpoPrimitiveModel[]) {
    this.models = models;
    this.attachedParams?.requestUpdate();
  }

  profileHitTest(x: number, y: number): TpoHit | null {
    const hit = [...this.hits].reverse().find((candidate) =>
      x >= candidate.left && x <= candidate.right && y >= candidate.top && y <= candidate.bottom);
    return hit ? { instanceId: hit.instanceId, profileId: hit.profileId, x, y } : null;
  }

  private timeToCoordinate(model: TpoPrimitiveModel, timestampSeconds: number) {
    const timeScale = this.attachedParams?.chart.timeScale();
    if (!timeScale) return null;
    const direct = timeScale.timeToCoordinate(timestampSeconds as Time);
    if (direct != null) return direct;
    if (model.lastCandleTime == null || model.intervalSeconds == null || model.intervalSeconds <= 0) return null;
    const lastCoordinate = timeScale.timeToCoordinate(model.lastCandleTime as Time);
    if (lastCoordinate == null) return null;
    const lastLogical = timeScale.coordinateToLogical(lastCoordinate);
    if (lastLogical == null) return null;
    return timeScale.logicalToCoordinate((Number(lastLogical) + (timestampSeconds - model.lastCandleTime) / model.intervalSeconds) as Logical);
  }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.attachedParams;
    if (!params || !this.models.length) {
      this.hits = [];
      return;
    }
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      this.hits = [];

      const visibleLogical = params.chart.timeScale().getVisibleLogicalRange();
      const visibleSpan = visibleLogical ? Math.max(1, Number(visibleLogical.to) - Number(visibleLogical.from)) : 80;
      const pixelsPerBar = mediaSize.width / visibleSpan;
      const latestProfileByInstance = new Map<string, number>();
      this.models.forEach((model, index) => {
        const currentIndex = latestProfileByInstance.get(model.instanceId);
        if (currentIndex == null || model.profile.startTimeMs > this.models[currentIndex].profile.startTimeMs) {
          latestProfileByInstance.set(model.instanceId, index);
        }
      });
      const coordinates = this.models.map((model) => ({
        start: this.timeToCoordinate(model, model.profile.startTimeMs / 1_000),
        end: this.timeToCoordinate(model, model.profile.endTimeMs / 1_000),
      }));
      const leftWallProfileByInstance = new Map<string, number>();
      this.models.forEach((model, index) => {
        if (!model.profile.rows.length || model.settings.showOnRight) return;
        const start = coordinates[index].start;
        if (start == null) return;
        const latest = latestProfileByInstance.get(model.instanceId) === index;
        const offset = (latest ? model.settings.currentOffset : model.settings.previousOffset) * pixelsPerBar;
        if (start + offset >= 2) return;
        const currentIndex = leftWallProfileByInstance.get(model.instanceId);
        if (currentIndex == null || model.profile.startTimeMs > this.models[currentIndex].profile.startTimeMs) {
          leftWallProfileByInstance.set(model.instanceId, index);
        }
      });

      this.models.forEach((model, modelIndex) => {
        const { profile, settings, theme } = model;
        if (!profile.rows.length) return;
        const periodStartX = coordinates[modelIndex].start;
        const periodEndX = coordinates[modelIndex].end;
        if (periodStartX == null || periodEndX == null) return;
        const latest = latestProfileByInstance.get(model.instanceId) === modelIndex;
        const baseCell = clamp(settings.blockSize, 2, 24);
        const periodWidth = Math.max(1, Math.abs(periodEndX - periodStartX));
        const requestedWidth = settings.widthMode === "window-percent"
          ? mediaSize.width * settings.currentWidth / 100
          : settings.widthMode === "period-percent"
            ? periodWidth * settings.currentWidth / 100
            : settings.widthMode === "fixed-bars"
              ? pixelsPerBar * settings.currentWidth
              : Math.min(periodWidth * 0.42, Math.max(72, pixelsPerBar * 28));
        const width = clamp(requestedWidth * (latest ? 1 : settings.previousWidth / Math.max(1, settings.currentWidth)), 22, mediaSize.width * 0.42);
        const offset = (latest ? settings.currentOffset : settings.previousOffset) * pixelsPerBar;
        const pinnedRight = settings.showOnRight;
        const behindLeftWall = !pinnedRight && periodStartX + offset < 2;
        if (behindLeftWall && leftWallProfileByInstance.get(model.instanceId) !== modelIndex) return;
        const anchorX = pinnedRight
          ? mediaSize.width - 4 - offset
          : clamp(periodStartX + offset, 2, mediaSize.width - 2);
        const direction = (pinnedRight || settings.mirror) ? -1 : 1;
        const maxTpos = Math.max(1, ...profile.rows.map((row) => row.tpoCount));
        const cellWidth = Math.min(baseCell, Math.max(1.25, width / maxTpos));
        const gap = Math.min(settings.blockGap, cellWidth * 0.35);
        const opacity = clamp(settings.opacityPercent / 100, 0, 1);
        const lowY = profile.profileLowTick == null ? null : params.series.priceToCoordinate(tickToPrice(profile.profileLowTick, profile.tickSize));
        const highY = profile.profileHighTick == null ? null : params.series.priceToCoordinate(tickToPrice(profile.profileHighTick, profile.tickSize));
        if (lowY == null || highY == null) return;
        let boundsLeft = anchorX;
        let boundsRight = anchorX;
        let boundsTop = Math.min(lowY, highY);
        let boundsBottom = Math.max(lowY, highY);
        const detailed = cellWidth >= 6;
        const showLetters = settings.displayType === "letters"
          || (settings.displayType === "automatic" && detailed);
        const micro = cellWidth < 1.8;
        let renderedBlocks = 0;
        const allCells = profile.rows.flatMap((row) => row.cells);
        const maxCellVolume = Math.max(1, ...allCells.map((cell) => cell.volume ?? 0));
        const maxCellDelta = Math.max(1, ...allCells.map((cell) => Math.abs(cell.delta ?? 0)));
        const latestSubperiodIndex = Math.max(0, ...profile.subperiods.map((subperiod) => subperiod.index));
        const rangeStyles = [1, 2, 3, 4].map((range) => ({
          enabled: Boolean(settings[`range${range}Enabled` as keyof TpoIndicatorSettings]),
          minimum: Number(settings[`range${range}Minimum` as keyof TpoIndicatorSettings]),
          volume: String(settings[`range${range}VolumeColor` as keyof TpoIndicatorSettings]),
          bid: String(settings[`range${range}BidColor` as keyof TpoIndicatorSettings]),
          ask: String(settings[`range${range}AskColor` as keyof TpoIndicatorSettings]),
        })).filter((range) => range.enabled).sort((left, right) => left.minimum - right.minimum);

        if (settings.showValueArea && settings.valueAreaShowBackground && profile.vahTick !== null && profile.valTick !== null) {
          const vahY = params.series.priceToCoordinate(tickToPrice(profile.vahTick + 0.5, profile.tickSize));
          const valY = params.series.priceToCoordinate(tickToPrice(profile.valTick - 0.5, profile.tickSize));
          if (vahY !== null && valY !== null) {
            context.globalAlpha = settings.valueAreaBackgroundOpacity / 100;
            context.fillStyle = settings.inheritThemeColours ? theme.valueArea : settings.valueAreaColor;
            context.fillRect(direction < 0 ? anchorX - width : anchorX, Math.min(vahY, valY), width, Math.abs(valY - vahY));
          }
        }

        profile.rows.forEach((row) => {
          const top = params.series.priceToCoordinate(tickToPrice(row.highTick + 0.5, profile.tickSize));
          const bottom = params.series.priceToCoordinate(tickToPrice(row.lowTick - 0.5, profile.tickSize));
          if (top == null || bottom == null) return;
          const rowTop = Math.min(top, bottom);
          const rowHeight = Math.max(0.75, Math.abs(bottom - top));
          if (rowTop > mediaSize.height || rowTop + rowHeight < 0) return;
          const inValueArea = profile.vahTick !== null && profile.valTick !== null
            && row.highTick <= profile.vahTick && row.lowTick >= profile.valTick;
          const rowColor = settings.inheritThemeColours ? theme.profile : settings.profileColor;
          const valueAreaColor = settings.inheritThemeColours ? theme.valueArea : settings.valueAreaColor;
          const pocRow = profile.pocTick !== null && row.lowTick <= profile.pocTick && row.highTick >= profile.pocTick;
          const splitGapCount = settings.splitMode === "all"
            ? Math.max(0, row.tpoCount - 1)
            : settings.splitMode === "last" && row.tpoCount > 1 ? 1 : 0;
          const sessionGapCount = row.cells.reduce((count, cell, index, cells) => (
            index > 0 && cell.sessionSegment !== cells[index - 1].sessionSegment ? count + 1 : count
          ), 0);
          const splitGap = cellWidth * 0.35;
          const rowWidth = micro
            ? width * row.tpoCount / maxTpos
            : Math.min(width, row.tpoCount * cellWidth + (splitGapCount + sessionGapCount) * splitGap);
          const rowLeft = direction < 0 ? anchorX - rowWidth : anchorX;
          if (micro) {
            context.globalAlpha = opacity * (inValueArea ? 0.82 : 0.46);
            context.fillStyle = pocRow && settings.pocHighlight
              ? settings.pocHighlightColor
              : inValueArea && settings.showValueArea && settings.valueAreaHighlight ? valueAreaColor : rowColor;
            context.fillRect(rowLeft, rowTop, rowWidth, rowHeight);
          } else {
            for (let cell = 0; cell < row.tpoCount && renderedBlocks < settings.maximumRenderedBlocks; cell += 1) {
              renderedBlocks += 1;
              const separatedBefore = settings.splitMode === "all"
                ? cell
                : settings.splitMode === "last" && cell === row.tpoCount - 1 ? 1 : 0;
              const sessionSeparatorsBefore = row.cells.slice(1, cell + 1).reduce((count, current, index) => (
                current.sessionSegment !== row.cells[index].sessionSegment ? count + 1 : count
              ), 0);
              const cellStart = cell * cellWidth + (separatedBefore + sessionSeparatorsBefore) * splitGap;
              const x = direction < 0
                ? anchorX - cellStart - cellWidth
                : anchorX + cellStart;
              const size = Math.max(0.6, Math.min(cellWidth - gap, rowHeight - Math.min(gap, rowHeight * 0.25)));
              const cellData = row.cells[cell];
              const metric = settings.colourCalculation === "delta"
                ? cellData?.delta ?? 0
                : settings.colourCalculation === "volume" ? cellData?.volume ?? 0 : cellData?.subperiodIndex ?? cell;
              const normalized = settings.colourCalculation === "delta"
                ? Math.abs(metric) / maxCellDelta
                : settings.colourCalculation === "volume" ? metric / maxCellVolume : (cell + 1) / Math.max(1, row.tpoCount);
              let cellColor = rowColor;
              if (settings.colourCalculation === "volume") cellColor = settings.fixedVolumeColor;
              if (settings.colourCalculation === "delta" && cellData?.delta !== null) {
                cellColor = (cellData?.delta ?? 0) >= 0 ? settings.fixedAskColor : settings.fixedBidColor;
              }
              if (settings.colourReference === "multiple-ranges") {
                const passing = rangeStyles.filter((range) => Math.abs(metric) >= range.minimum).at(-1);
                if (passing) {
                  cellColor = settings.colourCalculation === "delta"
                    ? metric >= 0 ? passing.ask : passing.bid
                    : passing.volume;
                }
              }
              const initialColours = [
                [settings.initialAColorEnabled, settings.initialAColor],
                [settings.initialBColorEnabled, settings.initialBColor],
                [settings.initialCColorEnabled, settings.initialCColor],
                [settings.initialDColorEnabled, settings.initialDColor],
              ] as const;
              const initial = initialColours[cellData?.subperiodIndex ?? -1];
              if (initial?.[0]) cellColor = initial[1];
              if (settings.colorOpenEnabled && cellData?.subperiodIndex === 0) cellColor = settings.openColor;
              if (settings.colorCloseEnabled && cellData?.subperiodIndex === latestSubperiodIndex) cellColor = settings.closeColor;
              if (settings.showValueArea && settings.valueAreaHighlight) {
                const highlighted = settings.valueAreaHighlightInside ? inValueArea : !inValueArea;
                if (highlighted) cellColor = settings.valueAreaHighlightInside ? valueAreaColor : settings.valueAreaOutsideColor;
              }
              if (pocRow && settings.pocHighlight) cellColor = settings.pocHighlightColor;
              context.globalAlpha = opacity
                * (settings.colourReference === "fading" ? 0.28 + clamp(normalized, 0, 1) * 0.72 : 1)
                * (inValueArea ? 0.92 : 0.68);
              context.fillStyle = cellColor;
              context.fillRect(x + gap / 2, rowTop + (rowHeight - size) / 2, size, size);
              if (settings.borderWidth > 0 && size >= 2.5) {
                context.globalAlpha = opacity * 0.62;
                context.strokeStyle = theme.background;
                context.lineWidth = settings.borderWidth;
                context.strokeRect(x + gap / 2, rowTop + (rowHeight - size) / 2, size, size);
              }
              if (showLetters && size >= settings.minimumTextSize + 1) {
                const fontSize = clamp(size * 0.72, settings.minimumTextSize, settings.maximumTextSize);
                context.globalAlpha = 0.96;
                context.fillStyle = theme.foreground;
                context.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(row.markers[cell] ?? "", x + cellWidth / 2, rowTop + rowHeight / 2);
              }
            }
          }
          boundsLeft = Math.min(boundsLeft, rowLeft);
          boundsRight = Math.max(boundsRight, rowLeft + rowWidth);
          boundsTop = Math.min(boundsTop, rowTop);
          boundsBottom = Math.max(boundsBottom, rowTop + rowHeight);
        });

        if (settings.barMarkerEnabled && detailed) {
          profile.subperiods.forEach((subperiod) => {
            if (subperiod.highTick === null || subperiod.lowTick === null || subperiod.openTick === null || subperiod.closeTick === null) return;
            const xOffset = subperiod.index * Math.max(1, cellWidth);
            const x = direction < 0 ? anchorX - xOffset - cellWidth / 2 : anchorX + xOffset + cellWidth / 2;
            const high = params.series.priceToCoordinate(tickToPrice(subperiod.highTick, profile.tickSize));
            const low = params.series.priceToCoordinate(tickToPrice(subperiod.lowTick, profile.tickSize));
            const open = params.series.priceToCoordinate(tickToPrice(subperiod.openTick, profile.tickSize));
            const close = params.series.priceToCoordinate(tickToPrice(subperiod.closeTick, profile.tickSize));
            if (high == null || low == null || open == null || close == null) return;
            const up = subperiod.closeTick >= subperiod.openTick;
            context.globalAlpha = opacity;
            context.strokeStyle = up ? settings.barMarkerUpColor : settings.barMarkerDownColor;
            context.fillStyle = context.strokeStyle;
            context.lineWidth = settings.barMarkerWidth;
            if (settings.barMarkerStyle === "candle") {
              context.beginPath();
              context.moveTo(x, high);
              context.lineTo(x, low);
              context.stroke();
            }
            if (settings.barMarkerShowOpenClose) {
              const bodyTop = Math.min(open, close);
              const bodyHeight = Math.max(1, Math.abs(close - open));
              context.fillRect(x - Math.max(0.5, settings.barMarkerWidth), bodyTop, Math.max(1, settings.barMarkerWidth * 2), bodyHeight);
            }
          });
        }

        const profileLineEnd = pinnedRight ? 0 : Math.min(mediaSize.width, Math.max(anchorX, periodEndX));
        const drawLevel = (
          tick: number | null,
          color: string,
          dash: number[],
          label: string,
          widthValue = 1,
          extensionMode: "none" | "until-first-interaction" | "to-window-end" = "none",
          showLabel = true,
          firstInteractionMs: number | null = null,
        ) => {
          if (tick == null) return;
          const y = params.series.priceToCoordinate(tickToPrice(tick, profile.tickSize));
          if (y == null || y < 0 || y > mediaSize.height) return;
          context.globalAlpha = 0.86;
          context.strokeStyle = color;
          context.lineWidth = widthValue;
          context.setLineDash(dash);
          context.beginPath();
          context.moveTo(anchorX, y);
          const interactionX = firstInteractionMs === null ? null : this.timeToCoordinate(model, firstInteractionMs / 1_000);
          const lineEnd = extensionMode === "to-window-end" && !pinnedRight
            ? mediaSize.width
            : extensionMode === "until-first-interaction" && !pinnedRight
              ? interactionX ?? mediaSize.width
              : profileLineEnd;
          context.lineTo(lineEnd, y);
          context.stroke();
          if (cellWidth >= 4 && showLabel) {
            context.globalAlpha = 0.9;
            context.fillStyle = color;
            context.font = "600 7px 'JetBrains Mono', monospace";
            context.textAlign = pinnedRight ? "left" : "right";
            context.textBaseline = "bottom";
            context.fillText(label, clamp(lineEnd + (pinnedRight ? 4 : -4), 18, mediaSize.width - 18), y - 2);
          }
        };
        if (settings.showPoc && settings.pocLineMode !== "none") drawLevel(
          profile.pocTick,
          settings.inheritThemeColours ? theme.poc : settings.pocLineColor,
          [],
          "POC",
          settings.pocLineWidth,
          settings.pocExtensionMode,
          settings.showPocPriceLabel,
          profile.pocFirstInteractionMs ?? null,
        );
        if (settings.showValueArea && settings.valueAreaShowLines) {
          const valueAreaColor = settings.inheritThemeColours ? theme.valueArea : settings.valueAreaLineColor;
          drawLevel(profile.vahTick, valueAreaColor, [3, 3], "VAH", settings.valueAreaLineWidth, settings.valueAreaExtensionMode, settings.valueAreaShowLabels, profile.vahFirstInteractionMs ?? null);
          drawLevel(profile.valTick, valueAreaColor, [3, 3], "VAL", settings.valueAreaLineWidth, settings.valueAreaExtensionMode, settings.valueAreaShowLabels, profile.valFirstInteractionMs ?? null);
        }
        if (settings.showInitialBalance) {
          const ibColor = settings.inheritThemeColours ? theme.muted : settings.initialBalanceLineColor;
          if (settings.initialBalanceShowHigh) drawLevel(profile.initialBalanceHighTick, ibColor, [2, 3], "IBH", settings.initialBalanceLineWidth);
          if (settings.initialBalanceShowLow) drawLevel(profile.initialBalanceLowTick, ibColor, [2, 3], "IBL", settings.initialBalanceLineWidth);
          if (settings.initialBalanceShowExtensions && profile.initialBalanceHighTick !== null && profile.initialBalanceLowTick !== null) {
            const range = profile.initialBalanceHighTick - profile.initialBalanceLowTick;
            settings.initialBalanceExtensionMultiples.split(",").map(Number)
              .filter((multiple) => Number.isFinite(multiple) && multiple > 0)
              .forEach((multiple) => {
                drawLevel(Math.round(profile.initialBalanceHighTick! + range * multiple), ibColor, [1, 3], `IB +${multiple}`, settings.initialBalanceLineWidth);
                drawLevel(Math.round(profile.initialBalanceLowTick! - range * multiple), ibColor, [1, 3], `IB -${multiple}`, settings.initialBalanceLineWidth);
              });
          }
        }
        if (settings.showSinglePrints) {
          profile.singlePrints.forEach((zone) => {
            const top = params.series.priceToCoordinate(tickToPrice(zone.highTick + 0.5, profile.tickSize));
            const bottom = params.series.priceToCoordinate(tickToPrice(zone.lowTick - 0.5, profile.tickSize));
            if (top == null || bottom == null) return;
            context.globalAlpha = settings.singlePrintFillZone ? settings.singlePrintFillOpacity / 100 : 0;
            context.fillStyle = settings.inheritThemeColours ? theme.singlePrint : settings.singlePrintColor;
            context.fillRect(Math.min(anchorX, profileLineEnd), Math.min(top, bottom), Math.abs(profileLineEnd - anchorX), Math.abs(bottom - top));
            if (settings.singlePrintLineWidth > 0) {
              drawLevel(zone.lowTick, settings.inheritThemeColours ? theme.singlePrint : settings.singlePrintColor, [2, 2], settings.singlePrintShowLabel ? "SINGLE" : "", settings.singlePrintLineWidth, settings.singlePrintExtensionMode, settings.singlePrintShowLabel, zone.firstInteractionMs ?? null);
            }
          });
        }
        profile.peaksValleys.forEach((feature) => {
          if ((feature.kind === "peak" && !settings.showPeaks) || (feature.kind === "valley" && !settings.showValleys)) return;
          drawLevel(
            feature.rowTick,
            feature.kind === "peak"
              ? settings.inheritThemeColours ? theme.peak : settings.peakColor
              : settings.inheritThemeColours ? theme.valley : settings.valleyColor,
            [1, 3],
            feature.kind === "peak" ? "PEAK" : "VALLEY",
          );
        });
        if (settings.showPoc
          && (settings.showDevelopingPoc || settings.pocLineMode === "developing" || settings.pocLineMode === "extend-shifted")
          && profile.developingPoc.length > 1) {
          context.globalAlpha = settings.pocLineMode === "extend-shifted" ? settings.pocGroupingOpacity / 100 : 0.8;
          context.strokeStyle = settings.inheritThemeColours ? theme.poc : settings.pocColor;
          context.lineWidth = 1;
          context.setLineDash([]);
          context.beginPath();
          let started = false;
          const developingPoints = profile.developingPoc.slice(settings.developingPocStartOffset)
            .filter((point, index, points) => index === 0
              || settings.pocLineMode !== "extend-shifted"
              || Math.abs(point.tick - points[index - 1].tick) >= settings.shiftedPocTicks);
          developingPoints.forEach((point) => {
            const x = this.timeToCoordinate(model, point.timeMs / 1_000);
            const y = params.series.priceToCoordinate(tickToPrice(point.tick, profile.tickSize));
            if (x == null || y == null) return;
            if (!started) { context.moveTo(x, y); started = true; } else context.lineTo(x, y);
          });
          if (started) context.stroke();
        }
        if (settings.showDevelopingValueArea) {
          const drawDevelopingBoundary = (points: Array<{ timeMs: number; tick: number }>) => {
            if (points.length < 2) return;
            context.globalAlpha = 0.68;
            context.strokeStyle = settings.inheritThemeColours ? theme.valueArea : settings.valueAreaLineColor;
            context.lineWidth = settings.valueAreaLineWidth;
            context.setLineDash([2, 2]);
            context.beginPath();
            let started = false;
            points.forEach((point) => {
              const x = this.timeToCoordinate(model, point.timeMs / 1_000);
              const y = params.series.priceToCoordinate(tickToPrice(point.tick, profile.tickSize));
              if (x == null || y == null) return;
              if (!started) { context.moveTo(x, y); started = true; } else context.lineTo(x, y);
            });
            if (started) context.stroke();
          };
          drawDevelopingBoundary(profile.developingVah);
          drawDevelopingBoundary(profile.developingVal);
        }

        if (model.selected || model.mergeEligible) {
          context.globalAlpha = model.selected ? 0.95 : 0.5;
          context.strokeStyle = theme.selection;
          context.lineWidth = model.selected ? 1.5 : 1;
          context.setLineDash(model.selected ? [] : [4, 3]);
          context.strokeRect(boundsLeft - 2, boundsTop - 2, Math.max(4, boundsRight - boundsLeft + 4), Math.max(4, boundsBottom - boundsTop + 4));
        }
        if (settings.showSummary && boundsBottom > 20) {
          const title = profile.memberProfileIds?.length
            ? `COMPOSITE TPO · ${profile.memberProfileIds.length} ${settings.indicatorVariant === "weekly-tpo" ? "WEEKS" : "DAYS"}`
            : `${settings.indicatorVariant === "weekly-tpo" ? "WEEKLY" : "TPO"} · ${profile.totalTpos} TPOS`;
          const price = (tick: number | null) => tick === null ? "—" : tickToPrice(tick, profile.tickSize).toFixed(2);
          const compact = `H ${price(profile.profileHighTick)}  L ${price(profile.profileLowTick)}  POC ${price(profile.pocTick)}  VA ${price(profile.valTick)}–${price(profile.vahTick)}`;
          const detail = [
            title,
            compact,
            `IB ${price(profile.initialBalanceLowTick)}–${price(profile.initialBalanceHighTick)}  ${profile.subperiods.length} periods`,
            settings.summaryShowVolume && profile.totalVolume !== null ? `VOL ${Math.round(profile.totalVolume).toLocaleString()}` : "",
            settings.summaryShowTrades && profile.totalTrades !== null ? `TRADES ${Math.round(profile.totalTrades).toLocaleString()}` : "",
            settings.summaryShowBidAsk && profile.bidVolume !== null && profile.askVolume !== null
              ? `BID ${Math.round(profile.bidVolume).toLocaleString()}  ASK ${Math.round(profile.askVolume).toLocaleString()}  Δ ${Math.round(profile.delta ?? 0).toLocaleString()}`
              : "",
          ].filter(Boolean);
          const lines = settings.summaryLayout === "full" ? detail : [title, compact];
          const fontSize = settings.summaryFontSize;
          context.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
          const boxWidth = Math.min(mediaSize.width - 8, Math.max(...lines.map((line) => context.measureText(line).width)) + 12);
          const boxHeight = lines.length * (fontSize + 4) + 8;
          const rightAligned = settings.summaryLocation.endsWith("right");
          const bottomAligned = settings.summaryLocation.startsWith("bottom");
          const boxX = rightAligned ? clamp(boundsRight - boxWidth, 4, mediaSize.width - boxWidth - 4) : clamp(boundsLeft, 4, mediaSize.width - boxWidth - 4);
          const boxY = bottomAligned ? clamp(boundsBottom - boxHeight, 4, mediaSize.height - boxHeight - 4) : clamp(boundsTop, 4, mediaSize.height - boxHeight - 4);
          context.globalAlpha = settings.summaryBackgroundOpacity / 100;
          context.fillStyle = settings.summaryBackgroundColor;
          context.fillRect(boxX, boxY, boxWidth, boxHeight);
          context.globalAlpha = 0.96;
          context.fillStyle = settings.summaryTextColor || theme.foreground;
          context.textAlign = "left";
          context.textBaseline = "top";
          lines.forEach((line, index) => context.fillText(line, boxX + 6, boxY + 4 + index * (fontSize + 4)));
        }
        if (profile.lowerGranularity) {
          context.globalAlpha = 0.85;
          context.fillStyle = theme.muted;
          context.font = "600 7px 'JetBrains Mono', monospace";
          context.textAlign = "left";
          context.fillText("LOWER DATA GRANULARITY", clamp(boundsLeft, 4, mediaSize.width - 126), clamp(boundsBottom + 11, 11, mediaSize.height - 4));
        }
        this.hits.push({
          instanceId: model.instanceId,
          profileId: profile.id,
          x: anchorX,
          y: boundsTop,
          left: Math.min(boundsLeft, boundsRight) - 4,
          right: Math.max(boundsLeft, boundsRight) + 4,
          top: boundsTop - 14,
          bottom: boundsBottom + 14,
        });
      });
      context.restore();
    });
  }
}
