import { SYMBOLS } from './market-simulator.js';
import { BOOKMAP_VISUAL_DEFAULTS, RollingDepthEngine } from './depth-engine.js';
import { DepthRenderer, priceLabel, timeLabel } from './renderer.js';
import {
  DepthMarketFeed,
  isFullDepthSource,
  normalizeLiquidityMapSymbol,
  symbolMatchesSnapshot,
} from './live-market.js';
import { DEFAULT_PALETTE, paletteCssGradient } from './palettes.js';
import {
  DEFAULT_INDICATOR_SETTINGS,
  analyzeOrderFlow,
  computeOrderbookImbalance,
  computeVolumeImbalance,
} from './order-flow-indicators.js';
import { panHistoryEnd, panPriceCenter, wheelColumnShift } from './history-navigation.js';
import {
  DEFAULT_UI_THEME,
  WEBSITE_THEME_STORAGE_KEY,
  applyUiTheme,
  setWebsiteThemeColors,
} from './ui-themes.js';

// Preserve roughly the same on-screen time window as the old 20 FPS / 1,800
// frame buffer while the presentation layer runs at 72 FPS.
const MAX_HISTORY = 6500;
const ABSOLUTE_MIN_TIME_COLUMN_PIXELS = 0.12;
const SPEEDS = [0.25, 0.5, 1, 2, 4];
const LIQUIDITY_MAP_SETTINGS_KEY = 'kwantdesk:liquidity-map-settings:v1';
const LIQUIDITY_MAP_TABS_KEY = 'kwantdesk:liquidity-map-tabs:v1';
const LIQUIDITY_MAP_SYMBOLS = new Set(['NQ', 'ES']);
const DEFAULT_INSTRUMENT_TABS = ['NQ', 'ES'];
const INSTRUMENT_ORDER = ['NQ', 'ES'];
const INDICATOR_ANALYSIS_INTERVAL_MS = 250;

const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];

class DepthForgeApp {
  constructor() {
    this.uiTheme = DEFAULT_UI_THEME;
    applyUiTheme(this.uiTheme);
    const restoredInstrumentTabs = this.#restoreInstrumentTabs();
    this.instrumentTabs = restoredInstrumentTabs.tabs;
    this.symbol = restoredInstrumentTabs.active;
    this.currentContractSymbol = SYMBOLS[this.symbol].contract;
    this.market = { intervalMs: 100 };
    this.sourceMode = 'connecting';
    this.liveStatus = { connected: false, readOnly: true, trading: false, levels: 0 };
    this.depthEngine = new RollingDepthEngine(MAX_HISTORY);
    this.renderer = new DepthRenderer($('heatmapCanvas'), $('cvdCanvas'), this.depthEngine);
    this.history = this.depthEngine.frames;
    this.tape = [];
    this.viewEnd = 0;
    this.playing = true;
    this.atLive = true;
    this.speed = 1;
    this.accumulator = 0;
    this.lastFrameTime = performance.now();
    this.renderRequested = true;
    this.lastUiUpdate = 0;
    this.tool = 'crosshair';
    this.drag = null;
    this.cvdDrag = null;
    this.frames = 0;
    this.fpsTimer = performance.now();
    this.eventCount = 0;
    this.readySymbol = '';
    this.pendingReadySymbol = '';
    this.symbolLoadActive = false;
    this.symbolLoadHideTimer = 0;
    this.view = {
      centerTick: null,
      visibleRows: 112,
      aggregation: 1,
      columnPixels: 1.24,
    };
    this.settings = {
      palette: DEFAULT_PALETTE,
      sensitivity: 1,
      heatmapDimming: BOOKMAP_VISUAL_DEFAULTS.heatmapDimming,
      heatmapFilter: 'auto',
      gaussianSigma: BOOKMAP_VISUAL_DEFAULTS.gaussianSigma,
      aggregateDepth: false,
      circleSize: BOOKMAP_VISUAL_DEFAULTS.circleSize,
      circleTransparency: BOOKMAP_VISUAL_DEFAULTS.circleTransparency,
      smartClustering: BOOKMAP_VISUAL_DEFAULTS.smartClustering,
      minimumTradeSize: BOOKMAP_VISUAL_DEFAULTS.minimumTradeSize,
      minimumPixelVolume: BOOKMAP_VISUAL_DEFAULTS.minimumPixelVolume,
      bubbleDifferential: true,
      autoCenter: true,
      trails: true,
      grid: true,
      domVisible: true,
      domWidth: null,
      heatmap: true,
      trades: true,
      profile: true,
      uiTheme: this.uiTheme,
      ...DEFAULT_INDICATOR_SETTINGS,
    };
    this.#restoreSettings();

    this.indicatorAnalysis = null;
    this.cvdHistory = [];
    this.cvdTradingDate = '';
    this.indicatorAnalysisKey = '';
    this.indicatorAnalysisSettingsKey = '';
    this.indicatorAnalysisAt = 0;
    this.depthLadderHtml = '';
    this.tapeHtml = '';
    this.lastRenderFailureAt = 0;
    this.#bindControls();
    this.#syncPaletteControls();
    this.#syncHeatmapControls();
    this.#syncVolumeDotControls();
    this.#syncIndicatorControls();
    this.#updateSymbolUi();
    this.#updateUi(true);
    this.resizeObserver = new ResizeObserver(() => this.requestRender());
    this.resizeObserver.observe($('chartArea'));
    requestAnimationFrame(timestamp => this.#loop(timestamp));
    this.liveFeed = new DepthMarketFeed({
      symbol: this.symbol,
      onSnapshot: (snapshot, metadata) => this.#ingestDepthSnapshot(snapshot, metadata),
      onStatus: status => this.#setLiveStatus(status),
      onCvdHistory: (points, tradingDate) => this.#replaceCvdHistory(points, tradingDate),
    });
    this.liveFeed.start();
  }

  #bindControls() {
    window.addEventListener('storage', event => {
      if (event.key === WEBSITE_THEME_STORAGE_KEY) this.#setUiTheme(DEFAULT_UI_THEME);
    });
    window.addEventListener('pageshow', () => this.#setUiTheme(DEFAULT_UI_THEME));
    $('instrumentTabList').addEventListener('click', event => {
      const tab = event.target.closest('.instrument-tab');
      if (!tab) return;
      if (event.target.closest('[data-close-instrument]')) {
        this.#closeInstrumentTab(tab.dataset.symbol);
        return;
      }
      this.switchSymbol(tab.dataset.symbol);
    });
    $('newTab').addEventListener('click', () => this.#openInstrumentPicker());
    $('symbolMenu').addEventListener('click', () => this.#openInstrumentPicker());
    $('closeInstrumentPicker').addEventListener('click', () => $('instrumentPicker').close());
    $('instrumentSearch').addEventListener('input', event => this.#renderInstrumentResults(event.target.value));
    $('instrumentResults').addEventListener('click', event => {
      const result = event.target.closest('[data-instrument-result]');
      if (!result) return;
      this.#addInstrumentTab(result.dataset.instrumentResult);
    });
    $('instrumentPicker').addEventListener('click', event => {
      if (event.target === $('instrumentPicker')) $('instrumentPicker').close();
    });

    all('.rail-button[data-tool]').forEach(button => button.addEventListener('click', () => this.#selectTool(button.dataset.tool)));
    this.#bindToggle('toggleHeatmap', 'heatmap');
    this.#bindToggle('toggleTrades', 'trades');
    this.#bindToggle('toggleProfile', 'profile');
    this.#bindToggle('toggleCvd', 'cvdPanel');

    all('[data-aggregation]').forEach(button => button.addEventListener('click', () => {
      this.view.aggregation = Number(button.dataset.aggregation);
      all('[data-aggregation]').forEach(candidate => candidate.classList.toggle('active', candidate === button));
      this.requestRender();
    }));

    $('panelCollapse').addEventListener('click', () => {
      const hidden = !$('inspector').classList.toggle('open');
      $('panelCollapse').textContent = hidden ? '‹' : '›';
      setTimeout(() => this.requestRender(), 170);
    });

    all('.inspector-tabs button').forEach(button => button.addEventListener('click', () => this.#openPanel(button.dataset.panel)));
    all('[data-panel-shortcut]').forEach(button => button.addEventListener('click', () => this.#openPanel(button.dataset.panelShortcut)));
    $('settingsButton').addEventListener('click', () => this.#openPanel('settings'));

    $('paletteSelect').addEventListener('change', event => {
      this.settings.palette = event.target.value;
      this.#syncPaletteControls();
      this.requestRender();
    });
    $('sensitivityRange').addEventListener('input', event => {
      this.settings.sensitivity = Number(event.target.value);
      $('sensitivityOutput').value = this.settings.sensitivity.toFixed(2);
      $('quickHeatRange').value = event.target.value;
      this.requestRender();
    });
    $('quickHeatRange').addEventListener('input', event => {
      this.settings.sensitivity = Number(event.target.value);
      $('sensitivityRange').value = event.target.value;
      $('sensitivityOutput').value = this.settings.sensitivity.toFixed(2);
      this.requestRender();
    });
    $('dimmingRange').addEventListener('input', event => {
      this.settings.heatmapDimming = Number(event.target.value);
      $('dimmingOutput').value = String(this.settings.heatmapDimming);
      this.requestRender();
    });
    $('heatmapFilterSelect').addEventListener('change', event => {
      this.settings.heatmapFilter = event.target.value;
      $('sigmaRange').disabled = event.target.value !== 'gaussian';
      this.requestRender();
    });
    $('sigmaRange').disabled = true;
    $('sigmaRange').addEventListener('input', event => {
      this.settings.gaussianSigma = Number(event.target.value);
      $('sigmaOutput').value = String(this.settings.gaussianSigma);
      this.requestRender();
    });
    $('bubbleRange').addEventListener('input', event => {
      this.settings.circleSize = Number(event.target.value);
      $('bubbleOutput').value = String(this.settings.circleSize);
      this.requestRender();
    });
    $('transparencyRange').addEventListener('input', event => {
      this.settings.circleTransparency = Number(event.target.value);
      $('transparencyOutput').value = String(this.settings.circleTransparency);
      this.requestRender();
    });
    $('clusteringRange').addEventListener('input', event => {
      this.settings.smartClustering = Number(event.target.value);
      $('clusteringOutput').value = String(this.settings.smartClustering);
      this.requestRender();
    });
    $('minimumTradeSizeRange').addEventListener('input', event => {
      this.settings.minimumTradeSize = Number(event.target.value);
      $('minimumTradeSizeOutput').value = String(this.settings.minimumTradeSize);
      this.requestRender();
    });
    $('minimumVolumeRange').addEventListener('input', event => {
      this.settings.minimumPixelVolume = Number(event.target.value);
      $('minimumVolumeOutput').value = String(this.settings.minimumPixelVolume);
      this.requestRender();
    });
    this.#bindCheckbox('autoCenter', 'autoCenter');
    this.#bindCheckbox('showTrails', 'trails');
    this.#bindCheckbox('showGrid', 'grid');
    this.#bindCheckbox('showDom', 'domVisible');
    this.#bindCheckbox('aggregateDepth', 'aggregateDepth');
    this.#bindCheckbox('bubbleDifferential', 'bubbleDifferential');
    this.#bindCheckbox('cvdEnabled', 'cvdEnabled');
    this.#bindCheckbox('cvdSplit', 'cvdSplit');
    this.#bindCheckbox('absorptionEnabled', 'absorptionEnabled');
    this.#bindCheckbox('absorptionAutomatic', 'absorptionAutomatic');
    this.#bindCheckbox('sweepsEnabled', 'sweepsEnabled');
    this.#bindCheckbox('sweepsAutomatic', 'sweepsAutomatic');
    this.#bindSelect('cvdRangeSelect', 'cvdRange');
    this.#bindSelect('cvdScaleSelect', 'cvdScale');
    this.#bindNumber('cvdMinimumTradeSize', 'cvdMinimumTradeSize');
    this.#bindNumber('cvdMaximumTradeSize', 'cvdMaximumTradeSize');
    this.#bindNumber('absorptionWindowMs', 'absorptionWindowMs');
    this.#bindNumber('absorptionMinimumVolume', 'absorptionMinimumVolume');
    this.#bindNumber('absorptionSdMultiplier', 'absorptionSdMultiplier');
    this.#bindNumber('sweepWindowMs', 'sweepWindowMs');
    this.#bindNumber('sweepMinimumVolume', 'sweepMinimumVolume');
    this.#bindNumber('sweepMinimumLevels', 'sweepMinimumLevels');
    this.#bindNumber('sweepSdMultiplier', 'sweepSdMultiplier');
    this.#bindNumber('imbalanceDepthLevels', 'imbalanceDepthLevels');
    $('resetSettings').addEventListener('click', () => this.#resetSettings());
    window.addEventListener('message', event => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'kwantdesk:liquidity-map-symbol') {
        const symbol = normalizeLiquidityMapSymbol(event.data.symbol);
        if (symbol) this.#addInstrumentTab(symbol, false);
        return;
      }
      if (event.data?.type === 'kwantdesk:liquidity-map-theme') {
        setWebsiteThemeColors(event.data.theme);
        this.#setUiTheme(DEFAULT_UI_THEME);
        return;
      }
      if (event.data?.type === 'kwantify:heatmap-workspace-settings') {
        this.settings.domVisible = event.data.domVisible !== false;
        const domWidth = Number(event.data.domWidth);
        if (Number.isFinite(domWidth)) this.settings.domWidth = Math.min(260, Math.max(30, domWidth));
        $('showDom').checked = this.settings.domVisible;
        this.requestRender();
      }
    });

    $('playPause').addEventListener('click', () => this.togglePlayback());
    $('goLive').addEventListener('click', () => this.goLive());
    $('returnToLive').addEventListener('click', () => this.goLive());
    $('stepBack').addEventListener('click', () => this.#stepReplay(-1));
    $('stepForward').addEventListener('click', () => this.#stepReplay(1));
    $('speedButton').addEventListener('click', () => this.#cycleSpeed());
    $('timeline').addEventListener('input', event => this.#scrub(Number(event.target.value)));
    $('clearTape').addEventListener('click', () => { this.tape = []; this.#renderTape(); });

    $('resetView').addEventListener('click', () => this.resetView());
    $('zoomIn').addEventListener('click', () => this.#zoom(0.82));
    $('zoomOut').addEventListener('click', () => this.#zoom(1.22));
    $('fullscreenButton').addEventListener('click', () => this.#toggleFullscreen());

    const canvas = $('heatmapCanvas');
    canvas.addEventListener('pointerenter', event => this.#pointerMove(event));
    canvas.addEventListener('pointermove', event => this.#pointerMove(event));
    canvas.addEventListener('pointerleave', () => this.#pointerLeave());
    canvas.addEventListener('pointerdown', event => this.#pointerDown(event));
    canvas.addEventListener('pointerup', event => this.#pointerUp(event));
    canvas.addEventListener('pointercancel', event => this.#pointerUp(event));
    canvas.addEventListener('wheel', event => this.#wheel(event), { passive: false });

    const cvdCanvas = $('cvdCanvas');
    cvdCanvas.addEventListener('pointerdown', event => this.#cvdPointerDown(event));
    cvdCanvas.addEventListener('pointermove', event => this.#cvdPointerMove(event));
    cvdCanvas.addEventListener('pointerup', event => this.#cvdPointerUp(event));
    cvdCanvas.addEventListener('pointercancel', event => this.#cvdPointerUp(event));
    cvdCanvas.addEventListener('wheel', event => this.#cvdWheel(event), { passive: false });
    cvdCanvas.addEventListener('dblclick', () => this.goLive());
    $('cvdGoLive').addEventListener('click', () => this.goLive());
    $('cvdSettingsButton').addEventListener('click', () => this.#openPanel('signals'));
    $('cvdStyleButton').addEventListener('click', event => {
      event.stopPropagation();
      const menu = $('cvdStyleMenu');
      const opening = menu.classList.contains('hidden');
      menu.classList.toggle('hidden', !opening);
      $('cvdStyleButton').setAttribute('aria-expanded', String(opening));
    });
    $('cvdStyleMenu').addEventListener('click', event => {
      const option = event.target.closest('[data-cvd-style]');
      if (!option) return;
      this.#setCvdDisplayStyle(option.dataset.cvdStyle);
    });
    document.addEventListener('pointerdown', event => {
      if (event.target.closest('.cvd-style-picker')) return;
      $('cvdStyleMenu').classList.add('hidden');
      $('cvdStyleButton').setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('pointerdown', event => {
      const inspector = $('inspector');
      if (!inspector.classList.contains('open')) return;
      if (event.target.closest('#inspector, [data-panel-shortcut], #settingsButton, #cvdSettingsButton')) return;
      inspector.classList.remove('open');
      all('[data-panel-shortcut]').forEach(button => button.classList.remove('active'));
    });

    $('helpButton').addEventListener('click', () => $('helpModal').showModal());
    $('closeHelp').addEventListener('click', () => $('helpModal').close());
    $('helpModal').addEventListener('click', event => {
      if (event.target === $('helpModal')) $('helpModal').close();
    });

    document.addEventListener('keydown', event => this.#keyDown(event));
    const persistControlChange = event => {
      if (!event.target.closest('#topDeck, #inspector')) return;
      queueMicrotask(() => this.#saveSettings());
    };
    document.addEventListener('input', persistControlChange);
    document.addEventListener('change', persistControlChange);
    document.addEventListener('click', persistControlChange);
  }

  #bindToggle(id, setting) {
    $(id).addEventListener('click', event => {
      this.settings[setting] = !this.settings[setting];
      event.currentTarget.classList.toggle('active-toggle', this.settings[setting]);
      if (setting === 'cvdPanel') this.#syncIndicatorLayout();
      this.requestRender();
    });
  }

  #bindCheckbox(id, setting) {
    $(id).addEventListener('change', event => {
      this.settings[setting] = event.target.checked;
      if (setting === 'autoCenter' && event.target.checked) this.view.centerTick = null;
      if (setting === 'cvdEnabled') this.#syncIndicatorLayout();
      if (setting === 'domVisible' && window.parent !== window) {
        window.parent.postMessage({
          type: 'kwantify:heatmap-dom-visibility',
          visible: this.settings.domVisible,
        }, window.location.origin);
      }
      this.requestRender();
    });
  }

  #bindSelect(id, setting) {
    $(id).addEventListener('change', event => {
      this.settings[setting] = event.target.value;
      this.requestRender();
    });
  }

  #bindNumber(id, setting) {
    $(id).addEventListener('input', event => {
      const minimum = event.target.min === '' ? -Infinity : Number(event.target.min);
      const maximum = event.target.max === '' ? Infinity : Number(event.target.max);
      let value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      if (Number.isFinite(minimum)) value = Math.max(minimum, value);
      if (Number.isFinite(maximum)) value = Math.min(maximum, value);
      this.settings[setting] = value;
      this.requestRender();
    });
  }

  #restoreInstrumentTabs() {
    try {
      const saved = JSON.parse(localStorage.getItem(LIQUIDITY_MAP_TABS_KEY) || 'null');
      const savedTabs = Array.isArray(saved) ? saved : saved?.tabs;
      const tabs = [...new Set((savedTabs || DEFAULT_INSTRUMENT_TABS)
        .map(value => normalizeLiquidityMapSymbol(value))
        .filter(symbol => SYMBOLS[symbol] && LIQUIDITY_MAP_SYMBOLS.has(symbol)))];
      const active = normalizeLiquidityMapSymbol(saved?.active);
      return {
        tabs: tabs.length ? tabs : ['NQ'],
        active: tabs.includes(active) ? active : (tabs[0] || 'NQ'),
      };
    } catch {
      return { tabs: [...DEFAULT_INSTRUMENT_TABS], active: 'NQ' };
    }
  }

  #persistInstrumentTabs() {
    try {
      localStorage.setItem(LIQUIDITY_MAP_TABS_KEY, JSON.stringify({
        tabs: this.instrumentTabs,
        active: this.symbol,
      }));
    } catch {
      // The live tabs still work for this session if browser storage is unavailable.
    }
  }

  #renderInstrumentTabs() {
    const tabList = $('instrumentTabList');
    if (!tabList) return;
    tabList.replaceChildren(...this.instrumentTabs.map(symbol => {
      const config = SYMBOLS[symbol];
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `instrument-tab${symbol === this.symbol ? ' active' : ''}`;
      tab.dataset.symbol = symbol;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(symbol === this.symbol));
      tab.title = `${config.description} · ${config.venue}`;

      const label = document.createElement('strong');
      const contract = symbol === this.symbol
        ? (this.currentContractSymbol || config.contract)
        : config.contract;
      label.textContent = `${contract} · ${config.venue}`;
      tab.append(label);

      if (this.instrumentTabs.length > 1) {
        const close = document.createElement('span');
        close.dataset.closeInstrument = symbol;
        close.setAttribute('role', 'button');
        close.setAttribute('aria-label', `Close ${symbol}`);
        close.textContent = '×';
        tab.append(close);
      }
      return tab;
    }));
    tabList.querySelector('.instrument-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  #renderInstrumentResults(query = '') {
    const normalizedQuery = String(query || '').trim().toUpperCase();
    const matches = INSTRUMENT_ORDER
      .filter(symbol => SYMBOLS[symbol])
      .filter(symbol => {
        const config = SYMBOLS[symbol];
        return !normalizedQuery || `${symbol} ${config.description} ${config.venue}`.toUpperCase().includes(normalizedQuery);
      });
    const results = $('instrumentResults');
    results.replaceChildren(...matches.map(symbol => {
      const config = SYMBOLS[symbol];
      const isOpen = this.instrumentTabs.includes(symbol);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `instrument-result${isOpen ? ' is-open' : ''}`;
      button.dataset.instrumentResult = symbol;
      button.setAttribute('role', 'option');
      button.innerHTML = `<span class="instrument-result-symbol">${symbol}</span><span class="instrument-result-copy"><strong>${config.description}</strong><small>${config.venue} · FULL DEPTH</small></span><span class="instrument-result-action">${isOpen ? 'OPEN' : 'ADD'}</span>`;
      return button;
    }));
    $('instrumentEmpty').classList.toggle('hidden', matches.length > 0);
  }

  #openInstrumentPicker() {
    const picker = $('instrumentPicker');
    const search = $('instrumentSearch');
    search.value = '';
    this.#renderInstrumentResults();
    if (!picker.open) picker.showModal();
    requestAnimationFrame(() => search.focus());
  }

  #addInstrumentTab(symbol, closePicker = true) {
    const normalized = normalizeLiquidityMapSymbol(symbol);
    if (!SYMBOLS[normalized] || !LIQUIDITY_MAP_SYMBOLS.has(normalized)) return;
    if (!this.instrumentTabs.includes(normalized)) this.instrumentTabs.push(normalized);
    if (closePicker && $('instrumentPicker').open) $('instrumentPicker').close();
    if (normalized === this.symbol) {
      this.#persistInstrumentTabs();
      this.#renderInstrumentTabs();
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: 'kwantdesk:liquidity-map-ready', symbol: this.symbol },
          window.location.origin,
        );
      }
      return;
    }
    this.switchSymbol(normalized);
  }

  #closeInstrumentTab(symbol) {
    if (this.instrumentTabs.length <= 1) return;
    const index = this.instrumentTabs.indexOf(symbol);
    if (index < 0) return;
    this.instrumentTabs.splice(index, 1);
    if (symbol === this.symbol) {
      const next = this.instrumentTabs[Math.min(index, this.instrumentTabs.length - 1)];
      this.switchSymbol(next);
      return;
    }
    this.#persistInstrumentTabs();
    this.#renderInstrumentTabs();
  }

  switchSymbol(symbol) {
    const normalized = normalizeLiquidityMapSymbol(symbol);
    if (!SYMBOLS[normalized] || !LIQUIDITY_MAP_SYMBOLS.has(normalized) || normalized === this.symbol) return;
    symbol = normalized;
    this.#beginSymbolLoad(symbol);
    this.symbol = symbol;
    this.currentContractSymbol = SYMBOLS[symbol].contract;
    this.sourceMode = 'connecting';
    this.depthEngine.reset();
    this.history = this.depthEngine.frames;
    this.cvdHistory = [];
    this.cvdTradingDate = '';
    this.tape = [];
    this.view.centerTick = null;
    this.accumulator = 0;
    this.readySymbol = '';
    this.pendingReadySymbol = '';
    this.atLive = true;
    this.playing = true;
    this.liveFeed.setSymbol(symbol);
    this.#persistInstrumentTabs();
    this.#updateSymbolUi();
    this.#renderTape();
    this.#updatePlaybackUi();
    this.#updateUi(true);
    this.requestRender();
  }

  #beginSymbolLoad(symbol) {
    clearTimeout(this.symbolLoadHideTimer);
    this.symbolLoadActive = true;
    $('symbolLoadingTitle').textContent = `Loading ${symbol} liquidity map`;
    $('symbolLoadingOverlay').classList.remove('hidden');
    this.#setSymbolLoadProgress(8, 'Opening market-depth feed');
  }

  #setSymbolLoadProgress(progress, stage) {
    if (!this.symbolLoadActive) return;
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    $('symbolLoadingStage').textContent = stage;
    $('symbolLoadingBar').style.width = `${value}%`;
    $('symbolLoadingPercent').textContent = `${value}%`;
    $('symbolLoadingTrack').setAttribute('aria-valuenow', String(value));
  }

  #finishSymbolLoad(symbol) {
    if (!this.symbolLoadActive || symbol !== this.symbol) return;
    this.#setSymbolLoadProgress(100, 'Live depth frame painted');
    clearTimeout(this.symbolLoadHideTimer);
    this.symbolLoadHideTimer = window.setTimeout(() => {
      if (symbol !== this.symbol) return;
      this.symbolLoadActive = false;
      $('symbolLoadingOverlay').classList.add('hidden');
    }, 180);
  }

  #updateSymbolUi() {
    const config = SYMBOLS[this.symbol];
    const isLiveDepth = this.sourceMode === 'live' && this.liveStatus.fullDepth === true;
    // Name the provider the feed actually reports rather than hard-coding one.
    const provider = String(this.liveStatus.provider || 'RITHMIC').toUpperCase();
    this.#renderInstrumentTabs();
    $('symbolLabel').textContent = this.currentContractSymbol || config.contract;
    $('depthSymbol').textContent = this.currentContractSymbol || config.contract;
    $('symbolDescription').textContent = config.description;
    $('symbolIcon').textContent = config.key[0];
    if ($('modeStatus')) $('modeStatus').lastChild.textContent = isLiveDepth ? ' LIVE L3' : ' CONNECTING';
    if ($('footerModeStatus')) $('footerModeStatus').textContent = isLiveDepth ? `${provider} L3 · READ-ONLY` : `CONNECTING TO ${provider}`;
    if (isLiveDepth) {
      const condition = this.liveStatus.connected ? 'LIVE' : 'STALE';
      $('feedStatus').textContent = `${provider} L3 · ${condition} · ${this.liveStatus.levels || 0} LEVELS · READ-ONLY`;
      if ($('sourceBanner')) {
        $('sourceBanner').textContent = this.liveStatus.connected
          ? `Live ${provider} depth-by-order · full resting book · trading disabled`
          : `${provider} depth-by-order frozen at the last exchange book · trading disabled`;
      }
    } else {
      const state = this.liveStatus.connected ? 'BUILDING L3 BOOK' : 'CONNECTING';
      $('feedStatus').textContent = `${state} · ${provider}`;
      if ($('sourceBanner')) $('sourceBanner').textContent = this.liveStatus.message || `Connecting to live ${provider} depth-by-order for ${this.symbol}`;
    }
  }

  #selectTool(tool) {
    this.tool = tool;
    all('.rail-button[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    this.#setChartCursor();
    if (tool !== 'measure') {
      this.renderer.setMeasurement(null);
      $('measurementLabel').classList.add('hidden');
    }
    this.requestRender();
  }

  #openPanel(panel) {
    $('inspector').classList.add('open');
    if (document.querySelector('.workspace').classList.contains('panel-hidden')) {
      document.querySelector('.workspace').classList.remove('panel-hidden');
      $('panelCollapse').textContent = '›';
      setTimeout(() => this.requestRender(), 170);
    }
    const mapping = { depth: 'depthPanel', signals: 'signalsPanel', settings: 'settingsPanel' };
    all('.inspector-tabs button').forEach(button => button.classList.toggle('active', button.dataset.panel === panel));
    all('[data-panel-shortcut]').forEach(button => button.classList.toggle('active', button.dataset.panelShortcut === panel));
    all('.inspector-panel').forEach(candidate => candidate.classList.toggle('active', candidate.id === mapping[panel]));
  }

  #restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(LIQUIDITY_MAP_SETTINGS_KEY) || 'null');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
      const allowed = new Set(Object.keys(this.settings));
      allowed.delete('uiTheme');
      for (const [key, value] of Object.entries(saved)) {
        if (!allowed.has(key) || value === null || !['string', 'number', 'boolean'].includes(typeof value)) continue;
        this.settings[key] = value;
      }
    } catch {
      localStorage.removeItem(LIQUIDITY_MAP_SETTINGS_KEY);
    }
  }

  #saveSettings() {
    try {
      const saved = { ...this.settings };
      delete saved.uiTheme;
      localStorage.setItem(LIQUIDITY_MAP_SETTINGS_KEY, JSON.stringify(saved));
    } catch {
      // Browser storage is optional; the live map remains usable without it.
    }
  }

  #resetSettings() {
    Object.assign(this.settings, {
      palette: DEFAULT_PALETTE, sensitivity: 1,
      heatmapDimming: BOOKMAP_VISUAL_DEFAULTS.heatmapDimming,
      heatmapFilter: 'auto', gaussianSigma: BOOKMAP_VISUAL_DEFAULTS.gaussianSigma,
      aggregateDepth: false, circleSize: BOOKMAP_VISUAL_DEFAULTS.circleSize,
      circleTransparency: BOOKMAP_VISUAL_DEFAULTS.circleTransparency,
      smartClustering: BOOKMAP_VISUAL_DEFAULTS.smartClustering,
      minimumTradeSize: BOOKMAP_VISUAL_DEFAULTS.minimumTradeSize,
      minimumPixelVolume: BOOKMAP_VISUAL_DEFAULTS.minimumPixelVolume,
      bubbleDifferential: true, autoCenter: true,
      trails: true, grid: true, domVisible: true, heatmap: true, trades: true, profile: true,
      ...DEFAULT_INDICATOR_SETTINGS,
    });
    this.#syncPaletteControls();
    this.#syncHeatmapControls();
    this.#syncVolumeDotControls();
    this.#syncIndicatorControls();
    $('autoCenter').checked = true;
    $('showTrails').checked = true;
    $('showGrid').checked = true;
    $('showDom').checked = true;
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'kwantify:heatmap-dom-visibility',
        visible: true,
      }, window.location.origin);
    }
    $('aggregateDepth').checked = false;
    $('bubbleDifferential').checked = true;
    $('toggleHeatmap').classList.add('active-toggle');
    $('toggleTrades').classList.add('active-toggle');
    $('toggleProfile').classList.add('active-toggle');
    $('toggleCvd').classList.add('active-toggle');
    this.view.centerTick = null;
    this.requestRender();
  }

  #syncVolumeDotControls() {
    $('bubbleRange').value = String(this.settings.circleSize);
    $('bubbleOutput').value = String(this.settings.circleSize);
    $('transparencyRange').value = String(this.settings.circleTransparency);
    $('transparencyOutput').value = String(this.settings.circleTransparency);
    $('clusteringRange').value = String(this.settings.smartClustering);
    $('clusteringOutput').value = String(this.settings.smartClustering);
    $('minimumTradeSizeRange').value = String(this.settings.minimumTradeSize);
    $('minimumTradeSizeOutput').value = String(this.settings.minimumTradeSize);
    $('minimumVolumeRange').value = String(this.settings.minimumPixelVolume);
    $('minimumVolumeOutput').value = String(this.settings.minimumPixelVolume);
    $('bubbleDifferential').checked = this.settings.bubbleDifferential;
  }

  #syncPaletteControls() {
    $('paletteSelect').value = this.settings.palette;
    $('heatPalettePreview').style.background = paletteCssGradient(this.settings.palette);
  }

  #syncHeatmapControls() {
    $('sensitivityRange').value = String(this.settings.sensitivity);
    $('quickHeatRange').value = String(this.settings.sensitivity);
    $('sensitivityOutput').value = this.settings.sensitivity.toFixed(2);
    $('dimmingRange').value = String(this.settings.heatmapDimming);
    $('dimmingOutput').value = String(this.settings.heatmapDimming);
    $('heatmapFilterSelect').value = this.settings.heatmapFilter;
    $('sigmaRange').value = String(this.settings.gaussianSigma);
    $('sigmaRange').disabled = this.settings.heatmapFilter !== 'gaussian';
    $('sigmaOutput').value = String(this.settings.gaussianSigma);
  }

  #syncIndicatorControls() {
    const checkboxSettings = {
      cvdEnabled: 'cvdEnabled',
      cvdSplit: 'cvdSplit',
      absorptionEnabled: 'absorptionEnabled',
      absorptionAutomatic: 'absorptionAutomatic',
      sweepsEnabled: 'sweepsEnabled',
      sweepsAutomatic: 'sweepsAutomatic',
    };
    for (const [id, setting] of Object.entries(checkboxSettings)) $(id).checked = Boolean(this.settings[setting]);
    $('cvdRangeSelect').value = this.settings.cvdRange;
    $('cvdScaleSelect').value = this.settings.cvdScale;
    this.#syncCvdDisplayStyle();
    const numberSettings = {
      cvdMinimumTradeSize: 'cvdMinimumTradeSize',
      cvdMaximumTradeSize: 'cvdMaximumTradeSize',
      absorptionWindowMs: 'absorptionWindowMs',
      absorptionMinimumVolume: 'absorptionMinimumVolume',
      absorptionSdMultiplier: 'absorptionSdMultiplier',
      sweepWindowMs: 'sweepWindowMs',
      sweepMinimumVolume: 'sweepMinimumVolume',
      sweepMinimumLevels: 'sweepMinimumLevels',
      sweepSdMultiplier: 'sweepSdMultiplier',
      imbalanceDepthLevels: 'imbalanceDepthLevels',
    };
    for (const [id, setting] of Object.entries(numberSettings)) $(id).value = String(this.settings[setting]);
    this.#syncIndicatorLayout();
  }

  #setCvdDisplayStyle(value) {
    const style = ['candles', 'line', 'bars'].includes(value) ? value : 'candles';
    this.settings.cvdDisplayStyle = style;
    this.#syncCvdDisplayStyle();
    this.#saveSettings();
    this.requestRender();
  }

  #syncCvdDisplayStyle() {
    const style = ['candles', 'line', 'bars'].includes(this.settings.cvdDisplayStyle)
      ? this.settings.cvdDisplayStyle
      : 'candles';
    const labels = { candles: 'CVD candles', line: 'CVD line', bars: 'CVD bars' };
    $('cvdStyleLabel').textContent = labels[style];
    all('[data-cvd-style]').forEach(option => {
      const selected = option.dataset.cvdStyle === style;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-checked', String(selected));
    });
    $('cvdStyleMenu').classList.add('hidden');
    $('cvdStyleButton').setAttribute('aria-expanded', 'false');
  }

  #syncIndicatorLayout() {
    const visible = this.settings.cvdEnabled && this.settings.cvdPanel;
    $('chartModule').classList.toggle('cvd-open', visible);
    $('toggleCvd').classList.toggle('active-toggle', this.settings.cvdPanel);
  }

  #setUiTheme(value) {
    const theme = applyUiTheme(value);
    this.uiTheme = theme.id;
    this.settings.uiTheme = theme.id;
    this.#syncPaletteControls();
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = theme.css['--ui-chrome'];
    this.requestRender();
  }

  #setLiveStatus(status) {
    this.liveStatus = { ...this.liveStatus, ...status };
    if (status.contractSymbol) this.currentContractSymbol = status.contractSymbol;
    if (this.symbolLoadActive) {
      if (Number(status.historyFrames) > 0) {
        this.#setSymbolLoadProgress(58, `Restoring ${Number(status.historyFrames).toLocaleString()} depth frames`);
      } else if (status.connected) {
        this.#setSymbolLoadProgress(32, 'Rithmic depth stream connected');
      }
    }
    this.#updateSymbolUi();
  }

  #ingestDepthSnapshot(snapshot, metadata = {}) {
    // Two separate gates rejected the Rithmic feed here. The source check was
    // pinned to Databento, and the symbol had to match literally - but the
    // collector serves micros from the parent book and answers with the
    // parent root, so an MNQ tab never matched an NQ snapshot.
    if (
      !symbolMatchesSnapshot(this.symbol, snapshot.symbol)
      || !isFullDepthSource(snapshot.source)
      || snapshot.readOnly !== true
    ) return;
    this.currentContractSymbol = snapshot.contractSymbol || this.currentContractSymbol;
    if (this.sourceMode !== 'live') {
      this.sourceMode = 'live';
      this.depthEngine.reset();
      this.history = this.depthEngine.frames;
      this.tape = [];
      this.view.centerTick = snapshot.midTick;
      this.viewEnd = 0;
      this.eventCount = 0;
      this.atLive = true;
      this.playing = true;
      this.accumulator = 0;
      this.#updateSymbolUi();
    }
    const wasAtLive = this.atLive && this.playing;
    if (this.symbolLoadActive) {
      this.#setSymbolLoadProgress(
        metadata.historical ? (metadata.final ? 88 : 72) : 88,
        metadata.historical ? 'Building historical liquidity columns' : 'Processing first live depth frame',
      );
    }
    const { shifted } = this.depthEngine.append(snapshot);
    if (!metadata.historical && !metadata.visualHold) {
      this.#appendLiveCvd(snapshot.timestamp, snapshot.delta);
    }
    this.#appendTrades(snapshot.trades);
    this.eventCount += snapshot.eventsSince ?? snapshot.trades.length + snapshot.bids.size + snapshot.asks.size;
    if (wasAtLive) {
      this.viewEnd = this.history.length - 1;
    } else if (shifted) {
      this.viewEnd = Math.max(0, this.viewEnd - shifted);
    }
    // Auto-center is an exact live viewport rule, not a lagging price chase.
    // Keep the centre unpinned so Renderer resolves it from the newest
    // snapshot against the current canvas dimensions on every paint.
    if (this.settings.autoCenter && wasAtLive) this.view.centerTick = null;
    if (!metadata.historical || metadata.final) {
      this.#updateUi(false);
      this.pendingReadySymbol = this.symbol;
      this.renderRequested = true;
    }
  }

  #replaceCvdHistory(points, tradingDate) {
    this.cvdHistory = (points || []).map(point => ({
      timestamp: Number(point.timestamp),
      open: Number(point.open || 0),
      high: Number(point.high || 0),
      low: Number(point.low || 0),
      close: Number(point.close ?? point.value ?? 0),
      value: Number(point.value ?? point.close ?? 0),
      buy: Number(point.buy || 0),
      sell: Number(point.sell || 0),
    })).sort((left, right) => left.timestamp - right.timestamp);
    this.cvdTradingDate = String(tradingDate || '');
    this.indicatorAnalysisKey = '';
    this.requestRender();
  }

  #appendLiveCvd(timestamp, delta) {
    const time = Number(timestamp);
    const change = Number(delta);
    if (!Number.isFinite(time) || !Number.isFinite(change) || change === 0) return;
    const bucket = time - (time % 60_000);
    const previous = this.cvdHistory.at(-1);
    if (previous?.timestamp === bucket) {
      const next = previous.value + change;
      previous.high = Math.max(previous.high, next);
      previous.low = Math.min(previous.low, next);
      previous.value = next;
      previous.close = next;
      previous.buy += Math.max(0, change);
      previous.sell += Math.min(0, change);
    } else {
      const open = Number(previous?.value || 0);
      const close = open + change;
      this.cvdHistory.push({
        timestamp: bucket,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        value: close,
        buy: Number(previous?.buy || 0) + Math.max(0, change),
        sell: Number(previous?.sell || 0) + Math.min(0, change),
      });
    }
    if (this.cvdHistory.length > 2_000) this.cvdHistory.splice(0, this.cvdHistory.length - 2_000);
  }

  #appendTrades(trades) {
    if (!trades.length) return;
    this.tape.unshift(...[...trades].reverse());
    if (this.tape.length > 35) this.tape.length = 35;
  }

  #loop(timestamp) {
    try {
      const elapsed = Math.min(120, timestamp - this.lastFrameTime);
      this.lastFrameTime = timestamp;
      this.accumulator += elapsed;

      if (this.playing) {
        const interval = this.market.intervalMs / this.speed;
        let guard = 0;
        while (this.accumulator >= interval && guard < 8) {
          if (!this.atLive && this.viewEnd < this.history.length - 1) {
            this.viewEnd += 1;
            this.renderRequested = true;
            if (this.viewEnd >= this.history.length - 1) this.goLive();
          }
          this.accumulator = this.sourceMode === 'live' && this.atLive ? 0 : this.accumulator - interval;
          guard += 1;
        }
      } else {
        this.accumulator = Math.min(this.accumulator, this.market.intervalMs);
      }

      if (this.renderRequested) {
        const current = this.history[this.viewEnd];
        if (current) {
          if (this.settings.autoCenter && this.atLive) this.view.centerTick = null;
          const indicatorAnalysis = this.#getIndicatorAnalysis();
          indicatorAnalysis.sessionCvd = { points: this.cvdHistory };
          this.renderer.render(this.history, this.viewEnd, this.view, this.settings, SYMBOLS[this.symbol], indicatorAnalysis);
          const rightMarketRailWidth = Math.max(
            0,
            Number(this.renderer.layout?.width || 0) - Number(this.renderer.layout?.plotWidth || 0),
          );
          $('chartModule').style.setProperty('--cvd-right-rail-width', `${rightMarketRailWidth}px`);
          this.#positionCurrentPrice(current);
          if (this.pendingReadySymbol === this.symbol && this.readySymbol !== this.symbol) {
            this.readySymbol = this.symbol;
            this.pendingReadySymbol = '';
            this.#finishSymbolLoad(this.symbol);
            if (window.parent !== window) {
              window.parent.postMessage(
                { type: 'kwantdesk:liquidity-map-ready', symbol: this.symbol },
                window.location.origin,
              );
            }
          }
        }
        this.renderRequested = false;
        this.frames += 1;
      }

      if (timestamp - this.lastUiUpdate > 180) {
        this.#updateUi(false);
        this.lastUiUpdate = timestamp;
      }

      if (timestamp - this.fpsTimer >= 1000) {
        $('fpsValue').textContent = `${Math.round(this.frames * 1000 / (timestamp - this.fpsTimer))} FPS`;
        this.frames = 0;
        this.fpsTimer = timestamp;
      }
    } catch (error) {
      // A single malformed or oversized frame must never permanently stop the
      // requestAnimationFrame chain. Drop only that paint and allow the next
      // genuine Rithmic frame (and all pointer controls) to keep running.
      this.renderRequested = false;
      if (timestamp - this.lastRenderFailureAt > 5_000) {
        this.lastRenderFailureAt = timestamp;
        console.error('Liquidity map frame was skipped.', error);
      }
    } finally {
      requestAnimationFrame(next => this.#loop(next));
    }
  }

  requestRender() { this.renderRequested = true; }

  #getIndicatorAnalysis() {
    if (this.drag && this.indicatorAnalysis) return this.indicatorAnalysis;
    const current = this.history[this.viewEnd];
    const first = this.history[0];
    const indicatorSettings = Object.fromEntries(
      Object.keys(DEFAULT_INDICATOR_SETTINGS).map(key => [key, this.settings[key]]),
    );
    const settingsKey = JSON.stringify(indicatorSettings);
    const key = `${first?.id ?? 0}:${current?.id ?? 0}:${this.viewEnd}`;
    const now = performance.now();
    const settingsChanged = settingsKey !== this.indicatorAnalysisSettingsKey;
    const dataChanged = key !== this.indicatorAnalysisKey;
    if (
      !this.indicatorAnalysis
      || settingsChanged
      || (dataChanged && now - this.indicatorAnalysisAt >= INDICATOR_ANALYSIS_INTERVAL_MS)
    ) {
      this.indicatorAnalysis = analyzeOrderFlow(this.history.slice(0, this.viewEnd + 1), indicatorSettings);
      this.indicatorAnalysisKey = key;
      this.indicatorAnalysisSettingsKey = settingsKey;
      this.indicatorAnalysisAt = now;
    }
    return this.indicatorAnalysis;
  }

  #updateUi(force) {
    const snapshot = this.history[this.viewEnd];
    if (!snapshot) return;
    const config = SYMBOLS[this.symbol];
    const lastPrice = snapshot.lastTick * config.tickSize;
    const change = snapshot.changeTicks * config.tickSize;
    const changePercent = change / Math.max(1, config.startPrice) * 100;
    $('lastPrice').textContent = lastPrice.toLocaleString(undefined, { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals });
    $('priceChange').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(config.decimals)}  ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
    $('priceChange').classList.toggle('positive', change >= 0);
    $('priceChange').classList.toggle('negative', change < 0);
    $('spreadValue').textContent = `${snapshot.bestAsk - snapshot.bestBid} TICK`;
    $('volumeValue').textContent = snapshot.totalVolume.toLocaleString();
    $('cvdValue').textContent = `${snapshot.cvd >= 0 ? '+' : ''}${Math.round(snapshot.cvd).toLocaleString()}`;
    $('eventCount').textContent = this.#compactNumber(this.eventCount);
    $('utcClock').innerHTML = `${new Date().toISOString().slice(11, 19)} <small>UTC</small>`;
    $('replayTime').textContent = timeLabel(snapshot.timestamp, true);
    $('rangeStart').textContent = timeLabel(this.history[0].timestamp, true);
    const timelineValue = this.history.length <= 1 ? 1000 : Math.round(this.viewEnd / (this.history.length - 1) * 1000);
    if (document.activeElement !== $('timeline')) $('timeline').value = String(timelineValue);
    this.#updateDepthLadder(snapshot, config);
    this.#updateMetrics(snapshot, config);
    if (force || snapshot.trades.length) this.#renderTape();
  }

  #updateDepthLadder(snapshot, config) {
    const rows = 17;
    const topTick = snapshot.bestAsk + 7;
    let maximum = 1;
    for (let tick = topTick; tick > topTick - rows; tick -= 1) {
      maximum = Math.max(maximum, snapshot.bids.get(tick) || 0, snapshot.asks.get(tick) || 0);
    }
    const html = [];
    for (let tick = topTick; tick > topTick - rows; tick -= 1) {
      const bid = snapshot.bids.get(tick) || 0;
      const ask = snapshot.asks.get(tick) || 0;
      const side = bid ? 'bid' : ask ? 'ask' : 'inside';
      const bestClass = tick === snapshot.bestBid ? ' best-bid' : tick === snapshot.bestAsk ? ' best-ask' : '';
      const bar = Math.round(Math.max(bid, ask) / maximum * 100);
      html.push(`<div class="depth-row ${side}${bestClass}" style="--bar:${bar}%"><span class="bid-size">${bid || ''}</span><span class="depth-price">${priceLabel(tick, config)}</span><span class="ask-size">${ask || ''}</span></div>`);
    }
    const nextHtml = html.join('');
    if (nextHtml !== this.depthLadderHtml) {
      this.depthLadderHtml = nextHtml;
      $('depthLadder').innerHTML = nextHtml;
    }
  }

  #updateMetrics(snapshot, config) {
    const bidRatio = Math.max(0, Math.min(1, snapshot.imbalance.ratio));
    const askRatio = 1 - bidRatio;
    const imbalancePercent = bidRatio * 100;
    $('imbalanceValue').textContent = `${imbalancePercent.toFixed(1)}% BID`;
    $('bidImbalance').style.width = `${imbalancePercent}%`;
    $('askImbalance').style.width = `${askRatio * 100}%`;
    $('bidPercent').textContent = `${Math.round(imbalancePercent)}%`;
    $('askPercent').textContent = `${Math.round(askRatio * 100)}%`;
    $('microPrice').textContent = priceLabel(snapshot.microTick, config);
    $('topDepth').textContent = this.#compactNumber(snapshot.imbalance.bid + snapshot.imbalance.ask);
    $('wallCount').textContent = String(snapshot.wallCount);
    $('tradeRate').textContent = `${snapshot.tradeRate.toFixed(1)}/s`;
    this.#updateSignals(snapshot);
  }

  #updateSignals(snapshot) {
    const analysis = this.#getIndicatorAnalysis();
    if (!analysis) return;
    const layoutMatches = this.renderer.layout?.history === this.history && this.renderer.layout.end === this.viewEnd;
    const visibleStart = layoutMatches ? this.renderer.layout.start : Math.max(0, this.viewEnd - 400);
    const currentPoint = analysis.cvd.points[this.viewEnd] || { value: 0, buy: 0, sell: 0 };
    const cvdBaseline = this.settings.cvdRange === 'visible' && visibleStart > 0
      ? analysis.cvd.points[visibleStart - 1] || { value: 0, buy: 0, sell: 0 }
      : { value: 0, buy: 0, sell: 0 };
    const cvd = {
      value: currentPoint.value - cvdBaseline.value,
      buy: currentPoint.buy - cvdBaseline.buy,
      sell: currentPoint.sell - cvdBaseline.sell,
    };
    const visibleTrades = analysis.trades.filter(trade => trade.frameIndex >= visibleStart && trade.frameIndex <= this.viewEnd);
    const volumeImbalance = computeVolumeImbalance(visibleTrades);
    const orderbookImbalance = computeOrderbookImbalance(snapshot, {
      levels: this.settings.imbalanceDepthLevels,
      decay: this.settings.imbalanceDecay,
    });
    const signed = value => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    const wholeSigned = value => `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString()}`;
    const flowState = value => value > .015
      ? { badge: 'BUY', className: 'bullish' }
      : value < -.015 ? { badge: 'SELL', className: 'bearish' } : { badge: 'FLAT', className: 'neutral' };
    const bookState = value => value > .015
      ? { badge: 'BID', className: 'bullish' }
      : value < -.015 ? { badge: 'ASK', className: 'bearish' } : { badge: 'FLAT', className: 'neutral' };
    const setSignal = (id, value, badge, className, detail) => {
      const article = $(id);
      article.querySelector('strong').textContent = value;
      article.querySelector('b').textContent = badge;
      article.querySelector('b').className = className;
      if (detail && article.querySelector('small')) article.querySelector('small').textContent = detail;
    };

    const cvdState = flowState(cvd.value);
    setSignal(
      'cvdSignal',
      `${wholeSigned(cvd.value)} contracts`,
      this.settings.cvdEnabled ? cvdState.badge : 'OFF',
      this.settings.cvdEnabled ? cvdState.className : 'quiet',
      this.settings.cvdRange === 'visible' ? 'Visible chart reference' : 'Loaded-history reference',
    );
    const volumeState = flowState(volumeImbalance.value);
    setSignal('volumeImbalanceSignal', signed(volumeImbalance.value * 100), volumeState.badge, volumeState.className, `${Math.round(volumeImbalance.buy + volumeImbalance.sell).toLocaleString()} visible contracts`);
    const orderbookState = bookState(orderbookImbalance.value);
    setSignal('orderbookImbalanceSignal', signed(orderbookImbalance.value * 100), orderbookState.badge, orderbookState.className, `Top ${this.settings.imbalanceDepthLevels} exponentially weighted levels`);

    const latestAtView = events => {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index].frameIndex <= this.viewEnd) return events[index];
      }
      return null;
    };
    const absorptionEvent = latestAtView(analysis.absorptionEvents);
    const absorptionAge = absorptionEvent ? snapshot.timestamp - absorptionEvent.timestamp : Infinity;
    const absorptionActive = absorptionAge >= 0 && absorptionAge <= Math.max(2_500, this.settings.absorptionWindowMs * 2);
    const absorptionThreshold = Math.round(analysis.thresholds.absorption).toLocaleString();
    if (!this.settings.absorptionEnabled) {
      setSignal('absorptionSignal', 'Indicator disabled', 'OFF', 'quiet', 'Enable below to scan exact prices');
    } else if (absorptionEvent) {
      const side = absorptionEvent.bookSide === 'bid' ? 'Bid' : 'Ask';
      setSignal(
        'absorptionSignal',
        `${side} ${priceLabel(absorptionEvent.tick, SYMBOLS[this.symbol])} · ${Math.round(absorptionEvent.volume).toLocaleString()}`,
        absorptionActive ? 'ACTIVE' : 'LAST',
        absorptionActive ? (absorptionEvent.bookSide === 'bid' ? 'bullish' : 'bearish') : 'quiet',
        `${(this.settings.absorptionWindowMs / 1_000).toFixed(2)}s window · threshold ${absorptionThreshold}`,
      );
    } else {
      setSignal('absorptionSignal', 'Monitoring exact price levels', 'NEUTRAL', 'neutral', `${(this.settings.absorptionWindowMs / 1_000).toFixed(2)}s window · threshold ${absorptionThreshold}`);
    }

    const sweepEvent = latestAtView(analysis.sweepEvents);
    const sweepAge = sweepEvent ? snapshot.timestamp - sweepEvent.timestamp : Infinity;
    const sweepActive = sweepAge >= 0 && sweepAge <= Math.max(2_000, this.settings.sweepWindowMs * 3);
    const sweepThreshold = Math.round(analysis.thresholds.sweep).toLocaleString();
    if (!this.settings.sweepsEnabled) {
      setSignal('sweepSignal', 'Indicator disabled', 'OFF', 'quiet', 'Enable below to scan multi-level trades');
    } else if (sweepEvent) {
      const side = sweepEvent.aggressiveSide === 'buy' ? 'Buy' : 'Sell';
      setSignal(
        'sweepSignal',
        `${side} ${priceLabel(sweepEvent.tick, SYMBOLS[this.symbol])} · ${sweepEvent.levelCount} levels`,
        sweepActive ? 'ACTIVE' : 'LAST',
        sweepActive ? (sweepEvent.aggressiveSide === 'buy' ? 'bullish' : 'bearish') : 'quiet',
        `${(this.settings.sweepWindowMs / 1_000).toFixed(2)}s window · ${Math.round(sweepEvent.volume).toLocaleString()} / ${sweepThreshold}`,
      );
    } else {
      setSignal('sweepSignal', 'No qualifying multi-level sweep', 'QUIET', 'quiet', `${(this.settings.sweepWindowMs / 1_000).toFixed(2)}s · ${this.settings.sweepMinimumLevels} levels · threshold ${sweepThreshold}`);
    }

    $('cvdValue').textContent = wholeSigned(cvd.value);
    $('cvdLegend').textContent = this.settings.cvdSplit
      ? `BUY ${Math.round(cvd.buy).toLocaleString()} · SELL ${Math.round(Math.abs(cvd.sell)).toLocaleString()} · NET ${wholeSigned(cvd.value)}`
      : `NET ${wholeSigned(cvd.value)} · ${this.settings.cvdRange.toUpperCase()}`;
  }

  #renderTape() {
    const config = SYMBOLS[this.symbol];
    const nextHtml = this.tape.slice(0, 18).map((trade, index) => `
      <div class="tape-row ${trade.side}${index === 0 ? ' flash' : ''}">
        <span>${timeLabel(trade.timestamp, true).slice(0, 12)}</span>
        <span class="price">${priceLabel(trade.tick, config)}</span>
        <span class="size">${trade.size}</span>
      </div>`).join('');
    if (nextHtml !== this.tapeHtml) {
      this.tapeHtml = nextHtml;
      $('tapeList').innerHTML = nextHtml;
    }
  }

  #positionCurrentPrice(snapshot) {
    const config = SYMBOLS[this.symbol];
    const tag = $('currentPriceTag');
    tag.textContent = priceLabel(snapshot.lastTick, config);
    tag.style.top = `${this.renderer.currentPriceY(snapshot.lastTick)}px`;
    const chartWidth = $('chartArea').clientWidth;
    const rightOffset = Math.max(0, chartWidth - (this.renderer.layout?.width || chartWidth));
    tag.style.right = `${rightOffset}px`;
  }

  togglePlayback() {
    this.playing = !this.playing;
    if (this.sourceMode === 'live' && !this.playing) this.atLive = false;
    this.accumulator = 0;
    this.#updatePlaybackUi();
  }

  #updatePlaybackUi() {
    $('playPause').querySelector('.pause-icon').classList.toggle('hidden', !this.playing);
    $('playPause').querySelector('.play-icon').classList.toggle('hidden', this.playing);
    $('playPause').setAttribute('aria-label', this.playing ? 'Pause replay' : 'Play replay');
    $('goLive').classList.toggle('active', this.atLive);
    $('returnToLive').classList.toggle('hidden', this.atLive);
    $('cvdGoLive').classList.toggle('active', this.atLive);
    $('cvdGoLive').textContent = this.atLive ? 'LIVE' : 'GO LIVE';
  }

  goLive() {
    this.atLive = true;
    this.viewEnd = this.history.length - 1;
    this.playing = true;
    this.accumulator = 0;
    if (this.settings.autoCenter) this.view.centerTick = null;
    this.#updatePlaybackUi();
    this.requestRender();
  }

  #stepReplay(direction) {
    this.atLive = false;
    this.playing = false;
    this.viewEnd = Math.max(0, Math.min(this.history.length - 1, this.viewEnd + direction));
    this.#updatePlaybackUi();
    this.#updateUi(true);
    this.requestRender();
  }

  #scrub(value) {
    this.viewEnd = Math.max(0, Math.min(this.history.length - 1, Math.round(value / 1000 * (this.history.length - 1))));
    this.atLive = this.viewEnd >= this.history.length - 1;
    this.playing = false;
    this.#updatePlaybackUi();
    this.#updateUi(true);
    this.requestRender();
  }

  #cycleSpeed() {
    const current = SPEEDS.indexOf(this.speed);
    this.speed = SPEEDS[(current + 1) % SPEEDS.length];
    $('speedButton').textContent = `${this.speed}×`;
  }

  resetView() {
    this.view.visibleRows = 112;
    this.view.columnPixels = 1.24;
    this.view.centerTick = this.settings.autoCenter ? null : this.history[this.viewEnd]?.midTick;
    this.renderer.setMeasurement(null);
    $('measurementLabel').classList.add('hidden');
    this.requestRender();
  }

  #canvasPoint(event) {
    const rect = $('heatmapCanvas').getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  #defaultChartCursor() {
    return this.tool === 'pan' ? 'grab' : 'crosshair';
  }

  #isPriceRailPoint(point) {
    const layout = this.renderer.layout;
    if (!layout || !point) return false;
    return point.y >= 0
      && point.y <= layout.plotHeight
      && point.x >= layout.plotWidth
      && point.x <= layout.plotWidth + layout.priceAxisWidth;
  }

  #isDomResizePoint(point) {
    const layout = this.renderer.layout;
    if (!layout || !point || !layout.domVisible) return false;
    return point.y >= 0
      && point.y <= layout.plotHeight
      && Math.abs(point.x - layout.plotWidth) <= 7;
  }

  #setChartCursor(point = null, dragging = false) {
    const cursor = dragging
      ? this.drag?.mode === 'dom-resize' ? 'ew-resize' : 'grabbing'
      : this.#isDomResizePoint(point)
        ? 'ew-resize'
      : this.#isPriceRailPoint(point)
        ? 'ns-resize'
        : this.#defaultChartCursor();
    $('heatmapCanvas').style.cursor = cursor;
    $('chartArea').style.cursor = cursor;
  }

  #pointerMove(event) {
    const point = this.#canvasPoint(event);
    if (this.drag?.mode === 'dom-resize') {
      event.preventDefault();
      const deltaX = point.x - this.drag.startX;
      this.settings.domWidth = Math.min(260, Math.max(30, this.drag.startWidth - deltaX));
      this.#setChartCursor(point, true);
      this.requestRender();
      return;
    }
    if (this.drag?.mode === 'price-pan') {
      event.preventDefault();
      const layout = this.renderer.layout;
      if (layout) {
        this.settings.autoCenter = false;
        $('autoCenter').checked = false;
        const currentCenter = this.view.centerTick ?? this.history[this.viewEnd].midTick;
        this.view.centerTick = panPriceCenter({
          centerTick: currentCenter,
          deltaY: point.y - this.drag.lastY,
          plotHeight: layout.plotHeight,
          visibleTickSpan: layout.visibleTickSpan,
        });
      }
      this.drag.lastY = point.y;
      this.#setChartCursor(point, true);
      this.requestRender();
      return;
    }
    if (this.drag?.mode === 'pan') {
      const dy = point.y - this.drag.last.y;
      const dx = point.x - this.drag.last.x;
      const layout = this.renderer.layout;
      if (layout) {
        this.settings.autoCenter = false;
        $('autoCenter').checked = false;
        this.view.centerTick = (this.view.centerTick ?? this.history[this.viewEnd].midTick) + dy / Math.max(1, layout.plotHeight) * layout.visibleTickSpan;
        if (Math.abs(dx) >= 2) {
          const columnShift = Math.round(-dx / Math.max(.6, this.view.columnPixels));
          if (columnShift !== 0) {
            this.viewEnd = Math.max(0, Math.min(this.history.length - 1, this.viewEnd + columnShift));
            this.atLive = this.viewEnd === this.history.length - 1;
            this.drag.last.x = point.x;
            this.#updatePlaybackUi();
          }
        }
      }
      this.drag.last.y = point.y;
      this.#setChartCursor(point, true);
      this.requestRender();
      return;
    }
    if (this.drag?.mode === 'measure') {
      this.drag.end = point;
      this.renderer.setMeasurement({ start: this.drag.start, end: point });
      const summary = this.renderer.measurementSummary(this.drag.start, point);
      if (summary) {
        const label = $('measurementLabel');
        label.textContent = summary.text;
        label.style.left = `${Math.min($('chartArea').clientWidth - 170, point.x + 10)}px`;
        label.style.top = `${Math.max(8, point.y - 24)}px`;
        label.classList.remove('hidden');
      }
      this.requestRender();
      return;
    }

    const domResize = this.#isDomResizePoint(point);
    const priceRail = this.#isPriceRailPoint(point);
    this.#setChartCursor(point);
    this.renderer.setHover(this.tool === 'crosshair' && !priceRail && !domResize ? point : null);
    if (this.tool === 'crosshair' && !priceRail && !domResize) this.#showTooltip(point);
    else $('chartTooltip').classList.add('hidden');
    this.requestRender();
  }

  #pointerLeave() {
    if (!this.drag) {
      this.renderer.setHover(null);
      $('chartTooltip').classList.add('hidden');
      this.#setChartCursor();
      this.requestRender();
    }
  }

  #pointerDown(event) {
    if (event.button !== 0) return;
    const point = this.#canvasPoint(event);
    const domResize = this.#isDomResizePoint(point);
    const pricePan = this.#isPriceRailPoint(point);
    const chartPan = this.tool === 'pan' || event.altKey;
    const measurement = this.tool === 'measure';
    if (!domResize && !pricePan && !chartPan && !measurement) return;
    event.preventDefault();
    $('heatmapCanvas').setPointerCapture(event.pointerId);
    if (domResize) {
      const defaultDomWidth = this.renderer.layout?.domWidth ?? 138;
      this.drag = {
        mode: 'dom-resize',
        startX: point.x,
        startWidth: this.settings.domWidth != null && Number.isFinite(Number(this.settings.domWidth))
          ? Number(this.settings.domWidth)
          : defaultDomWidth,
      };
      this.renderer.setHover(null);
      $('chartTooltip').classList.add('hidden');
      this.#setChartCursor(point, true);
    } else if (pricePan) {
      this.drag = { mode: 'price-pan', lastY: point.y };
      this.renderer.beginInteraction('price-pan');
      this.renderer.setHover(null);
      $('chartTooltip').classList.add('hidden');
      this.#setChartCursor(point, true);
    } else if (chartPan) {
      this.drag = { mode: 'pan', last: point };
      this.renderer.beginInteraction('pan');
      this.#setChartCursor(point, true);
    } else if (measurement) {
      this.drag = { mode: 'measure', start: point, end: point };
      this.renderer.setMeasurement({ start: point, end: point });
      this.requestRender();
    }
  }

  #pointerUp(event) {
    if (!this.drag) return;
    const completedDrag = this.drag;
    try { $('heatmapCanvas').releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
    this.drag = null;
    this.renderer.endInteraction();
    if (completedDrag.mode === 'dom-resize' && window.parent !== window) {
      window.parent.postMessage({
        type: 'kwantify:heatmap-dom-width',
        width: this.settings.domWidth,
      }, window.location.origin);
    }
    this.#setChartCursor(event.type === 'pointercancel' ? null : this.#canvasPoint(event));
    this.requestRender();
  }

  #showTooltip(point) {
    const hit = this.renderer.hitTest(point.x, point.y);
    const tooltip = $('chartTooltip');
    if (!hit) {
      tooltip.classList.add('hidden');
      return;
    }
    $('tooltipTime').textContent = `${hit.time} UTC`;
    $('tooltipPrice').textContent = hit.price;
    $('tooltipLiquidity').textContent = hit.liquidity.toLocaleString();
    $('tooltipVolume').textContent = hit.executed.toLocaleString();
    $('tooltipSide').textContent = hit.side;
    const area = $('chartArea');
    const left = point.x + 16 + 188 > area.clientWidth ? point.x - 201 : point.x + 16;
    const top = point.y + 12 + 126 > area.clientHeight ? point.y - 137 : point.y + 12;
    tooltip.style.left = `${Math.max(4, left)}px`;
    tooltip.style.top = `${Math.max(4, top)}px`;
    tooltip.classList.remove('hidden');
  }

  #wheel(event) {
    event.preventDefault();
    const layout = this.renderer.layout;
    if (!layout) return;
    const point = this.#canvasPoint(event);
    if (this.#isPriceRailPoint(point)) {
      // The right price rail behaves like a dedicated vertical scale. Wheel
      // input here stretches/compresses price spacing around the chart centre
      // and must never alter horizontal history density or position.
      const factor = event.deltaY > 0 ? 1.12 : 0.88;
      this.#zoom(factor, {
        x: layout.plotWidth,
        y: layout.plotHeight / 2,
      }, { price: true, time: false });
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + wheel is a horizontal density zoom: compress the time
      // columns to reveal more history on the left, or expand them to inspect
      // fewer columns. It must not pan the window or alter the price axis.
      const factor = event.deltaY > 0 ? 1.16 : 0.86;
      this.#zoom(factor, point, { price: false, time: true });
      return;
    }
    const factor = event.deltaY > 0 ? 1.12 : 0.88;
    const axes = event.shiftKey
      ? { price: false, time: true }
      : { price: true, time: true };
    this.#zoom(factor, point, axes);
  }

  #panHistory(columnShift) {
    const layout = this.renderer.layout;
    if (!layout || !this.history.length || columnShift === 0) return;
    const nextEnd = panHistoryEnd({
      currentEnd: this.viewEnd,
      columnShift,
      historyLength: this.history.length,
      visibleColumns: layout.count,
    });
    if (nextEnd === this.viewEnd) return;
    this.viewEnd = nextEnd;
    this.atLive = nextEnd === this.history.length - 1;
    this.playing = this.atLive;
    this.accumulator = 0;
    this.#updatePlaybackUi();
    this.#updateUi(true);
    this.requestRender();
  }

  #cvdWheel(event) {
    event.preventDefault();
    const layout = this.renderer.layout;
    if (!layout) return;
    if (event.ctrlKey || event.metaKey) {
      const factor = event.deltaY > 0 ? 1.16 : 0.86;
      const rect = $('cvdCanvas').getBoundingClientRect();
      this.#zoom(factor, {
        x: event.clientX - rect.left,
        y: layout.plotHeight / 2,
      }, { price: false, time: true });
      return;
    }
    this.#panHistory(wheelColumnShift({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      visibleColumns: layout.count,
      fast: event.shiftKey,
    }));
  }

  #cvdPointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    $('cvdCanvas').setPointerCapture(event.pointerId);
    this.cvdDrag = { lastX: event.clientX, remainder: 0 };
    $('cvdPanel').classList.add('dragging');
  }

  #cvdPointerMove(event) {
    if (!this.cvdDrag) return;
    event.preventDefault();
    const columnPixels = Math.max(.45, this.view.columnPixels || 1.24);
    const movement = event.clientX - this.cvdDrag.lastX + this.cvdDrag.remainder;
    const columnShift = Math.trunc(-movement / columnPixels);
    this.cvdDrag.lastX = event.clientX;
    this.cvdDrag.remainder = movement + columnShift * columnPixels;
    if (columnShift !== 0) this.#panHistory(columnShift);
  }

  #cvdPointerUp(event) {
    if (!this.cvdDrag) return;
    try { $('cvdCanvas').releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
    this.cvdDrag = null;
    $('cvdPanel').classList.remove('dragging');
  }

  #zoom(factor, point = null, { price = true, time = true } = {}) {
    const layout = this.renderer.layout;
    if (!layout) return;
    const anchor = point || { x: layout.dataWidth / 2, y: layout.plotHeight / 2 };

    if (price) {
      const anchorTick = layout.tickForY(Math.max(0, Math.min(layout.plotHeight, anchor.y)));
      const config = SYMBOLS[this.symbol];
      const depthRangePoints = config.depthRangePoints ?? config.tickSize * 110;
      const fullBookRows = Math.round(depthRangePoints * 2 / Math.max(Number.EPSILON, config.tickSize));
      this.view.visibleRows = Math.max(24, Math.min(Math.max(320, fullBookRows), this.view.visibleRows * factor));
      if (anchorTick != null && anchor.y <= layout.plotHeight) {
        const newSpan = this.view.visibleRows * this.view.aggregation;
        const fractionFromTop = anchor.y / Math.max(1, layout.plotHeight);
        this.view.centerTick = anchorTick - newSpan * (0.5 - fractionFromTop);
        this.settings.autoCenter = false;
        $('autoCenter').checked = false;
      }
    }

    if (time) {
      // Allow compression until all retained history fits. The former .45px
      // floor (combined with a .60px renderer floor) created a false barrier
      // even while thousands of loaded columns were still off-screen.
      const fitLoadedHistory = layout.dataWidth / Math.max(30, this.history.length);
      const minimumColumnPixels = Math.max(
        ABSOLUTE_MIN_TIME_COLUMN_PIXELS,
        Math.min(.45, fitLoadedHistory),
      );
      const nextColumnPixels = Math.max(
        minimumColumnPixels,
        Math.min(8, this.view.columnPixels / factor),
      );
      if (!this.atLive && anchor.x <= layout.dataWidth) {
        const fractionFromLeft = Math.max(0, Math.min(1, anchor.x / Math.max(1, layout.dataWidth)));
        const anchorIndex = layout.start + fractionFromLeft * Math.max(0, layout.count - 1);
        const visibleColumns = Math.max(30, Math.floor(layout.dataWidth / nextColumnPixels));
        const candidateEnd = Math.round(anchorIndex + (1 - fractionFromLeft) * (visibleColumns - 1));
        const latest = this.history.length - 1;
        const minimumEnd = Math.min(latest, visibleColumns - 1);
        this.viewEnd = Math.max(minimumEnd, Math.min(latest, candidateEnd));
        this.atLive = this.viewEnd === latest;
        this.#updatePlaybackUi();
      }
      this.view.columnPixels = nextColumnPixels;
    }

    this.requestRender();
  }

  #keyDown(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === ' ') { event.preventDefault(); this.togglePlayback(); }
    if (event.key.toLowerCase() === 'l') this.goLive();
    if (event.key.toLowerCase() === 'r') this.resetView();
    if (event.key.toLowerCase() === 'h') $('toggleHeatmap').click();
    if (event.key.toLowerCase() === 't') $('toggleTrades').click();
    if (event.key === 'Escape' && $('helpModal').open) $('helpModal').close();
  }

  async #toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* Fullscreen can be blocked by embedding contexts. */ }
  }

  #compactNumber(value) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(value);
  }
}

window.depthForge = new DepthForgeApp();
