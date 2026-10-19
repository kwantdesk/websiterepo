import {themePaint} from './site-theme.js?v=1';
import {gexStorage,gexTimeZone,gexFetch as fetch} from './site-runtime.js?v=1';
import { CHART_COLORS, exposureAlpha, niceTicks, intervalPreview, intervalStrikeWindow, foldIntervalUpdates, averagedIvRank, marketMapColor, squarifyTreemap, drawSignedVolume, drawIntervalPlot } from "./chart-primitives.js?v=1";
import { PRICE_CHART_TYPES, parsePriceRows, priceChartPresentation, drawPriceCandles, drawOptionVolume, drawDarkFlowArea, prepareDarkPoolLevels, DARK_POOL_LEVEL_COLUMNS, EQUITY_PRINT_COLUMNS, EXCHANGE_NOTIFICATION_COLUMNS, NOTIFICATION_TYPES, equitySideColorToken, equityPrintColorToken, notificationColorToken } from "./equity-renderers.js?v=2";
import { MARKET_SHARE_MODES, marketShareModel, drawMarketSharePie, drawMarketShareBars, drawProportionChart, contractStatisticsRows, contractSideStatisticsRows, GAINERS_COLUMNS, MARKET_SHARE_COLUMNS, CONSOLIDATED_COLUMNS, gainersModel, marketShareTableModel, netDriftRows, flowStatisticsModel, exchangeColor, exchangeLabel, EXCHANGE_GROUP_COLORS } from "./options-models.js?v=2";
import { HEAT_METRICS, heatMetricFor, heatCellValue, heatCellColor, niceValueDomain, exposureStrikeWindow, drawExposureBars, MAX_PAIN_STYLES, heatMapInitialWindow } from "./exposure-models.js?v=1";
import { createTableView } from "./table-view.js?v=2";
import { selectedSnapshotSpot, completedMinuteSnapshot, sessionMinuteTimestamp, snapshotControlTimeline, equityOptionSnapshotSchedule } from "./snapshot-model.js?v=2";
import { timeDomain, timeX, timeTicks, nearestTimeIndex,timeAtIndex } from "./time-axis.js?v=1";
import { abbreviate, currencyAbbreviated, currencyAuto, abbreviatedTick } from "./number-format.js?v=2";
import {bootWorkspace,applyDocumentPreferences,getConfiguration,getFilterOverrides,getFilterGroups,filterGroupTypeForTool,showFilterGroups,popup,showToolConfiguration,showDataDialog,confirmLocalAction} from './workspace-ui.js?v=3';
import {instrumentChoices,setChoiceValue,snapshotTimeOptions,multiChoiceDropdown} from './choice-controls.js?v=2';
import {resolveFilterOverride,normalizeAPIExpression,expirationFilterForTool} from './preferences-model.js?v=1';
import {normalizeWheelDelta,wheelZoomWindow,panZoomWindow,heatMapPlainWheel,cursorTooltipPlacement,sliderBarWindow,sliderHandleWindow,sliderTrackClick,lerpZoomStep} from './chart-interaction-model.js?v=1';
import {bindZoomNavigator,navigatorPreviewDomain} from './navigator-ui.js?v=3';
import {liveChartWindow,compatibleLiveTimeline} from './live-chart-model.js?v=1';
import {OPTION_TRADE_DETAIL_ENDPOINT,UNCONSOLIDATED_COLUMNS,optionTradeDetailRequest,unconsolidatedTradeRows} from './option-trade-detail-model.js?v=1';
import {MARKET_MAP_SLIDER_MAX,MARKET_MAP_CAMERA_IDENTITY,marketMapMaxZoom,clampMarketMapCamera,wheelMarketMapCamera,panMarketMapCamera,marketMapCameraWindows,applyMarketMapWindow,marketMapWorldPoint} from './market-map-interaction-model.js?v=1';
const VIEW_PARAMETERS=new URLSearchParams(location.search),EMBEDDED=VIEW_PARAMETERS.get('embed')==='1';
document.documentElement.classList.toggle('embedded',EMBEDDED);
document.documentElement.classList.toggle('host-timezone-control',VIEW_PARAMETERS.get('hostTimezone')==='1');
let toolConfiguration=applyDocumentPreferences();

const PERIOD_OPTIONS = [
  ["1m", "1 Min"], ["2m", "2 Minutes"], ["3m", "3 Minutes"], ["4m", "4 Minutes"],
  ["5m", "5 Minutes"], ["10m", "10 Minutes"], ["15m", "15 Minutes"],
  ["20m", "20 Minutes"], ["30m", "30 Minutes"], ["1h", "1 Hour"],
  ["2h", "2 Hours"], ["4h", "4 Hours"]
];


const chartState = new WeakMap();
let apiStatus = { connected: false, mode: "archive-preview" };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

for (const select of $$(".aggregation-period")) {
  for (const [value, label] of PERIOD_OPTIONS) {
    select.add(new Option(label, value, value === "1m", value === "1m"));
  }
}

const toolbarTemplate = $("#driftToolbarTemplate");
for (const panel of $$(".drift-panel")) {
  const fragment = toolbarTemplate.content.cloneNode(true);
  $(".symbol-pill", fragment).textContent = panel.dataset.ticker;
  $(".drift-toolbar", panel).append(fragment);
}


function formatMoney(value, compact = true) {
  if (!Number.isFinite(value)) return "—";
  return compact?currencyAbbreviated(value,2):formatPrice(value);
}

function formatExposure(value) {
  if (!Number.isFinite(value)) return "—";
  return abbreviate(value,2);
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayChartTime(time) {
  return new Date(Number(time)).toLocaleTimeString("en-US",{timeZone:gexTimeZone(),hour:"numeric",minute:"2-digit",hour12:true});
}

function chartStrikeLabel(value) {
  return currencyAuto(value);
}

function drawIntervalProfile(canvas,points,min,max) {
  const {ctx,width,height}=canvasContext(canvas);ctx.clearRect(0,0,width,height);
  const sorted=points.filter(point=>point.strike>=min&&point.strike<=max).sort((a,b)=>a.strike-b.strike),maximum=Math.max(1,...sorted.map(point=>Math.abs(point.value)));
  ctx.beginPath();ctx.moveTo(0,height);sorted.forEach(point=>ctx.lineTo(Math.abs(point.value)/maximum*width,height-(point.strike-min)/Math.max(1e-9,max-min)*height));ctx.lineTo(0,0);ctx.closePath();ctx.fillStyle=themePaint("rgba(112,15,236,.18)");ctx.fill();ctx.strokeStyle=themePaint("#700FEC");ctx.lineWidth=1;ctx.stroke();
}

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function scale(value, fromMin, fromMax, toMin, toMax) {
  if (fromMax === fromMin) return (toMin + toMax) / 2;
  return toMin + ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin);
}

function grid(ctx, left, top, right, bottom, xCount = 5, yCount = 8) {
  ctx.save();
  ctx.strokeStyle = themePaint("rgba(104, 52, 151, .18)");
  ctx.lineWidth = 1;
  for (let i = 0; i <= xCount; i++) {
    const x = left + ((right - left) * i) / xCount;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let i = 0; i <= yCount; i++) {
    const y = top + ((bottom - top) * i) / yCount;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }
  ctx.restore();
}

function line(ctx, points, color, width = 2) {
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  ctx.restore();
}

function unwrapArchive(response) {
  return response?.mode === "archive-preview" ? response.data : response;
}

function aggregateExposure(response, ticker) {
  const payload = unwrapArchive(response);
  const root = payload?.data?.[ticker] || payload?.[ticker] || payload?.data || {};
  const exposureMap = root.exposureMap || {};
  const byStrike = new Map();
  for (const expiration of Object.values(exposureMap)) {
    if (!expiration || typeof expiration !== "object") continue;
    for (const [strikeText, leg] of Object.entries(expiration)) {
      const strike = Number(strikeText);
      if (!Number.isFinite(strike) || !leg || typeof leg !== "object") continue;
      const current = byStrike.get(strike) || { strike, call: 0, put: 0 };
      current.call += Number(leg.callExposure || 0);
      current.put += Number(leg.putExposure || 0);
      byStrike.set(strike, current);
    }
  }
  const points = [...byStrike.values()].map((d) => ({ ...d, value: d.call + d.put })).sort((a, b) => a.strike - b.strike);
  return { points, spot: Number(root.stockPrice), total: points.reduce((sum, d) => sum + d.value, 0) };
}

function parseNetDrift(response) {
  const data=unwrapArchive(response)?.data||unwrapArchive(response)||{};
  return netDriftRows(data,{underlyingRequired:Object.values(data).some(row=>Number(row?.stockPrice)>0)});
}


function parsePrices(response) {
  const payload = unwrapArchive(response);
  const data = payload?.data || payload || {};
  return Object.entries(data)
    .filter(([key, value]) => /^\d+$/.test(key) && value && typeof value === "object")
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([time, row]) => ({
      time: Number(time),
      spot: Number(row.closePrice ?? row.stockPrice ?? row.openPrice)
    }))
    .filter((row) => Number.isFinite(row.spot));
}

function parseInterval(response, prices = []) {
  const payload = unwrapArchive(response);
  const data = payload?.data || payload || {};
  const updates = {...data};
  const firstUpdate = Math.min(...Object.keys(data).filter(key=>/^\d+$/.test(key)).map(Number));
  for(const price of prices)if(price.time>=firstUpdate&&!Object.hasOwn(updates,price.time))updates[price.time]={};
  const buckets = foldIntervalUpdates(updates);
  if (prices.length && buckets.length) {
    for (const bucket of buckets) {
      let nearest = prices[0];
      for (const point of prices) {
        if (Math.abs(point.time - bucket.time) < Math.abs(nearest.time - bucket.time)) nearest = point;
      }
      bucket.spot = nearest.spot;
    }
  }
  return buckets;
}


function drawExposure(panel, model) {
  const canvas = $(".chart-canvas", panel);
  const { ctx, width, height } = canvasContext(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!model.points.length) return;
  const spot = model.spot, strikes=model.points.map(point=>point.strike);
  const [start,end]=exposureStrikeWindow(strikes,spot);
  const greek = $(".greek-mode", panel).value;
  const greekName = greek[0] + greek.slice(1).toLowerCase();
  const greekCode = greek === "GAMMA" ? "GEX" : greek === "DELTA" ? "DEX" : greek === "CHARM" ? "CHEX" : "VEX";
  drawExposureBars(ctx,width,height,model.points,{
    orientation:'VERTICAL',display:'NET',spot,start,end,
    axisName:`${greekName} Exposure (${ $(".representation-mode",panel).selectedOptions[0].text })`,
    categoryName:'Strike Price ($)',categoryFormatter:point=>chartStrikeLabel(point.strike),
    valueFormatter:formatExposure,axisFont:width<500?10:13
  });
  $(".chart-heading h2", panel).textContent = `Net ${greekName} Exposure By Strike - ${panel.dataset.ticker}`;
  $(".exposure-label", panel).textContent = `Net ${greekCode}`;
  $(".exposure-total", panel).textContent = `(${formatExposure(model.total)})`;
  $(".spot-price", panel).textContent = `(${formatPrice(spot)})`;
  drawMini($(".vertical-zoom .zoom-wave", panel),model.points);
}

function drawInterval(panel, rows) {
  const canvas = $(".chart-canvas", panel), {ctx,width,height} = canvasContext(canvas);
  ctx.clearRect(0,0,width,height);
  const bounds = drawIntervalPlot(ctx,width,height,rows,{
    padding: Math.max(0,Number(panelInput(panel,".strike-padding"))||0),
    left: width < 500 ? 77 : 98, right: width-12, axisFont: width < 500 ? 10 : 13,
    formatTime: displayChartTime, formatStrike: chartStrikeLabel
  });
  const ticker=panel.dataset.ticker,greek=$(".greek-mode",panel).value;
  $(".chart-heading h2",panel).textContent=`Interval Map (${greek==="GAMMA"?"GEX":greek==="DELTA"?"DEX":greek==="CHARM"?"CHEX":"VEX"}) - ${ticker}`;
  $(".spot-price",panel).textContent=`(${formatPrice(rows.at(-1)?.spot)})`;
  drawZoomCanvas($(".horizontal-zoom canvas",panel),intervalPreview(rows));
  const profile = $(".vertical-zoom",panel);
  if(profile && bounds) {
    let rail=profile.querySelector("canvas");
    if(!rail){rail=document.createElement("canvas");rail.className="interval-profile";profile.append(rail);}
    drawIntervalProfile(rail,rows.at(-1)?.strikes||[],bounds.minY,bounds.maxY);
  }
}

function drawDrift(panel, rows) {
  const {ctx,width,height}=canvasContext($(".chart-canvas",panel));
  ctx.clearRect(0,0,width,height);if(!rows.length)return;
  const left=58,right=width-53,top=8,bottom=height-28;
  const paneHeight=Math.min(100,height*.15),gap=Math.min(20,height*.1),volumeTop=bottom-paneHeight,mainBottom=volumeTop-gap;
  const finiteBounds=values=>{const finite=values.filter(Number.isFinite);let min=Math.min(0,...finite),max=Math.max(0,...finite);if(min===max)max=min+1;return[min,max];};
  const rawPremium=finiteBounds(rows.flatMap(row=>[row.call,row.put])),{min:pmin,max:pmax}=niceValueDomain(...rawPremium);
  const prices=rows.map(row=>row.spot).filter(Number.isFinite),smin=Math.min(...prices),smax=Math.max(...prices);
  const volumes=rows.map(row=>row.callVolume-row.putVolume),[vmin,vmax]=finiteBounds(volumes);
  const domain=timeDomain(rows),x=index=>timeX(rows[index].time,domain,left,right),py=value=>scale(value,pmin,pmax,mainBottom,top),sy=value=>scale(value,smin,smax,mainBottom,top),vy=value=>scale(value,vmin,vmax,bottom,volumeTop);
  ctx.font="700 9px Aleph, sans-serif";ctx.fillStyle=themePaint("#fff");ctx.textAlign="right";
  for(const value of niceTicks(pmin,pmax)){const y=py(value);ctx.strokeStyle=CHART_COLORS.grid;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(formatMoney(value),left-7,y+3);}
  line(ctx,rows.map((row,index)=>[x(index),py(row.call)]),CHART_COLORS.call,2);
  line(ctx,rows.map((row,index)=>[x(index),py(row.put)]),CHART_COLORS.put,2);
  line(ctx,rows.map((row,index)=>[x(index),sy(row.spot)]).filter(point=>Number.isFinite(point[1])),CHART_COLORS.price,2);
  drawSignedVolume(ctx,volumes.map((value,index)=>[x(index),vy(value)]),vy(0),volumeTop,bottom);
  ctx.fillStyle=themePaint("#fff");ctx.textAlign="left";
  for(const value of niceTicks(smin,smax))ctx.fillText(chartStrikeLabel(value),right+6,sy(value)+3);
  ctx.textAlign="right";for(const value of niceTicks(vmin,vmax,2))ctx.fillText(formatExposure(value),left-7,vy(value)+3);
  ctx.save();ctx.translate(17,(top+mainBottom)/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText("Premium ($)",0,0);ctx.restore();
  ctx.save();ctx.translate(width-8,(top+mainBottom)/2);ctx.rotate(Math.PI/2);ctx.textAlign="center";ctx.fillText("Underlying ($)",0,0);ctx.restore();
  ctx.save();ctx.translate(17,(volumeTop+bottom)/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText("Volume",0,0);ctx.restore();
  ctx.textAlign="center";for(const time of timeTicks(domain.min,domain.max,right-left,9))ctx.fillText(displayChartTime(time),timeX(time,domain,left,right),bottom+15);
  const last=rows.at(-1);$(".call-total",panel).textContent=`(${formatMoney(last.call)})`;$(".put-total",panel).textContent=`(${formatMoney(last.put)})`;$(".spot-price",panel).textContent=`(${formatPrice(last.spot)})`;
  drawZoomCanvas($(".horizontal-zoom canvas",panel),rows.map(row=>row.call));
}

function drawZoomCanvas(canvas, values) {
  if (!canvas || !values?.length) return;
  const { ctx, width, height } = canvasContext(canvas);
  ctx.clearRect(0, 0, width, height);
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return;
  const min = Math.min(...finite), max = Math.max(...finite);
  const points = finite.map((value, index) => [scale(index, 0, Math.max(1, finite.length - 1), 0, width), scale(value, min, max, height - 2, 2)]);
  ctx.fillStyle = themePaint("rgba(109, 25, 181, .28)");
  ctx.beginPath(); ctx.moveTo(0, height); points.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
  line(ctx, points, themePaint("#812ad1"), 1);
}

function drawMini(container,points) {
  if(!container)return;
  container.style.background='none';container.style.inset='0 3px';
  let canvas=container.querySelector('canvas');
  if(!canvas){canvas=document.createElement('canvas');canvas.style.width='100%';canvas.style.height='100%';canvas.style.display='block';container.append(canvas);}
  if(!points?.length){const {ctx,width,height}=canvasContext(canvas);ctx.clearRect(0,0,width,height);return;}
  const strikes=points.map(point=>point.strike).filter(Number.isFinite);
  if(strikes.length)drawIntervalProfile(canvas,points,Math.min(...strikes),Math.max(...strikes));
}

function drawPanel(panel) {
  const state = chartState.get(panel);
  if (!state) return;
  if (panel.dataset.panel === "exposure") drawExposure(panel, state);
  else if (panel.dataset.panel === "interval") drawInterval(panel, state);
  else drawDrift(panel, state);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({ error: "Invalid response" }));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function panelInput(panel, selector) {
  return $(selector, panel)?.value;
}

async function fetchTool(tool, body) {
  return fetchJson(`/api/gex-data/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function fetchArchive(kind, ticker) {
  return fetchJson(`/api/gex-data/archive?kind=${encodeURIComponent(kind)}&ticker=${encodeURIComponent(ticker)}`);
}

const boardExposureState=new WeakMap();

function boardExposureRequest(settings,timestamp=null,latest=false) {
  const body={ticker:settings.ticker,filter:{expirationDates:settings.expirationDate?[settings.expirationDate]:undefined},greekMode:settings.greekMode,representationMode:settings.representationMode};
  if(Number.isFinite(timestamp)&&!latest)body.snapshotTime=new Date(completedMinuteSnapshot(timestamp)).toISOString();
  else if(settings.sessionDate)body.sessionDate=settings.sessionDate;
  return body;
}

function configureBoardExposureTime(panel,state,key,timeline) {
  const input=$('.time-control input',panel),label=$('.time-control b',panel),labels=$('.time-labels',panel);
  if(!input)return null;
  if(!timeline.length){input.disabled=true;if(label)label.textContent='Time · snapshot timeline unavailable';return null;}
  const previousKey=state.timelineKey;
  if(previousKey&&previousKey!==key)state.selections.set(previousKey,Number(input.value));
  state.timelineKey=key;state.timeline=timeline;
  const selected=state.selections.has(key)?state.selections.get(key):Math.min(189,timeline.length-1);
  input.min='0';input.max=String(timeline.length-1);input.step='1';input.value=String(Math.max(0,Math.min(timeline.length-1,selected)));input.disabled=false;
  const updateLabel=()=>{
    const index=Math.max(0,Math.min(state.timeline.length-1,Number(input.value)||0));
    state.selections.set(state.timelineKey,index);
    const text=displayChartTime(state.timeline[index]);if(label)label.textContent=`Time · ${text}`;
    input.setAttribute('aria-label','Exposure snapshot minute');input.setAttribute('aria-valuetext',text);input.title=text;
  };
  if(!state.bound){input.addEventListener('input',()=>{updateLabel();reloadPanel(panel);});state.bound=true;}
  updateLabel();
  if(labels){labels.replaceChildren();for(const fraction of [0,1/3,2/3,1]){const span=document.createElement('span');span.textContent=displayChartTime(timeline[Math.round((timeline.length-1)*fraction)]);labels.append(span);}}
  return timeline[Number(input.value)];
}

async function loadExposure(panel) {
  const ticker=panel.dataset.ticker;
  let state=boardExposureState.get(panel);
  if(!state){state={sequence:0,timelines:new Map(),selections:new Map()};boardExposureState.set(panel,state);}
  const requestId=++state.sequence;
  const settings={ticker,expirationDate:panelInput(panel,'.snapshot-date'),sessionDate:panelInput(panel,'.session-date'),greekMode:panelInput(panel,'.greek-mode'),representationMode:panelInput(panel,'.representation-mode')};
  const work=(async()=>{
  if (!apiStatus.connected) {
    try {
      const archived = aggregateExposure(await fetchArchive("exposure", ticker), ticker);
      if (archived.points.length) return archived;
    } catch { /* Retain an existing licensed archive only. */ }
    throw new Error("Licensed exposure data is unavailable for this session");
  }
  const key=`${ticker}|${settings.sessionDate||'latest'}`;
  if(!state.timelines.has(key)){
    const promise=fetchTool('stock-price-over-time',{ticker,sessionDate:settings.sessionDate||undefined,aggregationPeriod:'1m'}).then(response=>{
      const prices=parsePrices(response),sessionDate=settings.sessionDate||apiStatus.market?.optionsSessionDate;
      return sessionDate?snapshotControlTimeline(prices,{sessionDate,schedule:equityOptionSnapshotSchedule(ticker,sessionDate,apiStatus.market?.calendar)}):prices.map(row=>({time:row.time,kind:'snapshot'}));
    }).catch(error=>{state.timelines.delete(key);throw error;});
    state.timelines.set(key,promise);
  }
  const entries=await state.timelines.get(key),timeline=entries.map(entry=>entry.time);
  if(requestId!==state.sequence)return null;
  const timestamp=configureBoardExposureTime(panel,state,key,timeline);
  if(timestamp==null)throw new Error('No licensed minute timestamps returned for this session');
  const response=await fetchTool('exposure-by-strike',boardExposureRequest(settings,timestamp,entries.find(entry=>entry.time===timestamp)?.kind==='latest'));
  const parsed = aggregateExposure(response, ticker);
  if (!parsed.points.length) throw new Error("No exposure rows returned for this session");
  return parsed;
  })();
  state.latest=work;
  // Older loadPanel invocations must resolve with the newest request, not draw
  // a late historical snapshot over a newer slider/filter selection.
  let pending=work,expected=requestId;
  for(;;){
    try{const result=await pending;if(expected===state.sequence)return result;}
    catch(error){if(expected===state.sequence)throw error;}
    pending=state.latest;expected=state.sequence;
  }
}

async function loadInterval(panel) {
  const ticker = panel.dataset.ticker;
  if (!apiStatus.connected) throw new Error("Licensed interval data is unavailable");
  const body = {
    ticker,
    filter: { expirationDate: panelInput(panel, ".snapshot-date") || undefined },
    sessionDate: panelInput(panel, ".session-date"),
    greekMode: panelInput(panel, ".greek-mode"),
    aggregationPeriod: panelInput(panel, ".aggregation-period"),
    strikePadding: panelInput(panel, ".strike-padding")
  };
  const [interval, price] = await Promise.all([
    fetchTool("interval-map", body),
    fetchTool("stock-price-over-time", { ticker, sessionDate: body.sessionDate, aggregationPeriod: body.aggregationPeriod }).catch(() => null)
  ]);
  const rows = parseInterval(interval, price ? parsePrices(price) : []);
  if (!rows.length) throw new Error("No interval-map rows returned for this session");
  return rows;
}

async function loadDrift(panel) {
  const ticker = panel.dataset.ticker;
  if (!apiStatus.connected) {
    if (ticker === "QQQ") {
      try {
        const rows = parseNetDrift(await fetchArchive("net-drift", ticker));
        if (rows.length) return rows;
      } catch { /* Use the reference preview. */ }
    }
    throw new Error("Licensed Net Drift data is unavailable for this session");
  }
  const response = await fetchTool("net-drift", {
    ticker,
    filter: { expirationDates: panelInput(panel, ".snapshot-date") ? [panelInput(panel, ".snapshot-date")] : undefined },
    sessionDate: panelInput(panel, ".session-date"),
    aggregationPeriod: "1m",
    moneyType: panelInput(panel, ".money-type"),
    strikePrice: panelInput(panel, ".strike-price")
  });
  const rows = parseNetDrift(response);
  if (!rows.length) throw new Error("No net-drift rows returned for this session");
  return rows;
}

async function loadPanel(panel) {
  panel.setAttribute("aria-busy", "true");
  panel.classList.remove("error");
  panel.removeAttribute("data-error");
  try {
    const model = panel.dataset.panel === "exposure" ? await loadExposure(panel)
      : panel.dataset.panel === "interval" ? await loadInterval(panel)
      : await loadDrift(panel);
    chartState.set(panel, model);
    drawPanel(panel);
  } catch (error) {
    panel.classList.add("error");
    panel.dataset.error = error.message;
    if (!chartState.has(panel)) {
      const {ctx,width,height}=canvasContext($(".chart-canvas",panel));
      ctx.clearRect(0,0,width,height);
    }
  } finally {
    panel.setAttribute("aria-busy", "false");
  }
}

async function loadAll() {
  await Promise.all($$(".panel").map(loadPanel));
}

window.addEventListener('gex-data-timezone',()=>{for(const panel of $$('.panel'))drawPanel(panel);});

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

const reloadPanel = debounce((panel) => loadPanel(panel));
for (const panel of $$(".panel")) {
  panel.addEventListener("change", (event) => {
    if (event.target.matches("input,select")) reloadPanel(panel);
  });
  panel.addEventListener("input", (event) => {
    if (event.target.matches(".strike-padding,.strike-price")) reloadPanel(panel);
  });
}

$("#refreshAll").addEventListener("click", loadAll);

const fullscreenButton = $$('.top-action').find((button) => button.title === 'Fullscreen');
fullscreenButton?.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

const resize = debounce(() => $$(".panel").forEach(drawPanel), 100);
new ResizeObserver(resize).observe($("#dashboard"));

async function boot() {
  try {
    apiStatus = await fetchJson("/api/gex-data/status");
  } catch {
    apiStatus = { connected: false, mode: "archive-preview" };
  }
  const badge = $("#sourceBadge");
  const copy = $("#statusCopy");
  if (apiStatus.connected) {
    badge.classList.add("live");
    $("span", badge).textContent = "GATEWAY READY";
    copy.textContent = "Shared market-data connection ready";
  } else {
    $("span", badge).textContent = "ARCHIVE PREVIEW";
    copy.textContent = "Licensed connection unavailable · only saved source data can be shown";
  }
  // Docked tools own all data requests; never load the old fixed-date board.
}

await boot();

// ---------------------------------------------------------------------------
// GEX DATA tool library: licensed live tools + frozen historical snapshots.
// The six-panel KES board above remains intact; these pages share its gateway.
// ---------------------------------------------------------------------------
{
  const TOOL_DEFINITIONS = [
    { id: "dark-flow", title: "Dark Flow", group: "Equities", icon: "◒", endpoint: "dark-flow", view: "darkFlow", controls: ["mode", "date", "ticker", "period"], liveMs: 15000, description: "Dark-pool notional flow through the session with an underlying price overlay." },
    { id: "dark-pool-levels", title: "Dark Pool Levels", group: "Equities", icon: "≋", endpoint: "dark-pool-levels", view: "darkLevels", controls: ["ticker", "rangeStart", "rangeEnd", "topLevels", "levelMetric"], liveMs: 30000, description: "Active off-exchange price levels ranked by notional value, trade count, or volume." },
    { id: "equity-prints", title: "Equity Prints", group: "Equities", icon: "▤", endpoint: "equity-prints", view: "table", controls: ["mode", "date", "ticker", "printType"], liveMs: 8000, description: "Real-time equity tape with quantity, price, notional, venue type, and bid/ask context." },
    { id: "exchange-notifications", title: "Exchange Notifications", group: "Equities", icon: "!", endpoint: "exchange-notifications", view: "table", controls: ["mode", "date", "tickerOptional", "notificationType"], liveMs: 15000, description: "REG SHO, LUDP, IPO, halt, and other regulatory events across the market." },
    { id: "market-map", title: "Market Map", group: "Equities", icon: "▦", endpoint: "market-map", view: "marketMap", controls: ["mode", "date", "sector", "industry", "mapGroup"], liveMs: 30000, description: "Live equity heat map grouped by sector and weighted by market capitalization." },
    { id: "stock-price-over-time", title: "Stock Price / Time", group: "Equities", icon: "⌁", endpoint: "stock-price-over-time", view: "ohlc", controls: ["mode", "date", "ticker", "period", "chartType"], liveMs: 10000, description: "Intraday underlying OHLC movement with flexible intervals and chart styles." },

    { id: "order-flow-consolidated", title: "Consolidated Order Flow", group: "Order Flow", icon: "⇶", endpoint: "order-flow-consolidated", view: "table", controls: ["mode", "date", "ticker", "moneyType", "tradeType"], liveMs: 6000, description: "Unified blocks, splits, and sweeps with contract, premium, Greeks, side, and sentiment." },
    { id: "option-price-over-time", title: "Contract Price / Time", group: "Order Flow", icon: "⌇", endpoint: "option-price-over-time", view: "optionOhlc", controls: ["mode", "date", "ticker", "osi", "expiry", "strike", "contractType", "period", "chartType"], liveMs: 10000, description: "Intraday option OHLC and volume for one contract, with automatic recent-contract discovery." },
    { id: "contract-trade-side-statistics", title: "Contract Side Statistics", group: "Order Flow", icon: "◐", endpoint: "contract-trade-side-statistics", view: "sideStats", controls: ["mode", "date", "tickerOptional", "moneyType", "sideMetric", "expiry", "strike"], liveMs: 15000, description: "Call and put activity split across above-ask, ask, mid, bid, and below-bid trade sides." },
    { id: "contract-statistics", title: "Contract Statistics", group: "Order Flow", icon: "◑", endpoint: "contract-statistics", view: "contractStats", controls: ["mode", "date", "tickerOptional", "moneyType", "tradeSide", "expiry", "strike"], liveMs: 15000, description: "Call-vs-put premium, volume, and trade-count totals for the selected flow slice." },
    { id: "gainers-losers", title: "Gainers / Losers", group: "Order Flow", icon: "↕", endpoint: "gainers-losers", view: "gainers", controls: ["mode", "date", "tickerOptional", "sector", "industry", "rankMetric"], liveMs: 20000, description: "Rank symbols by bullish or bearish option premium, volume, and activity." },
    { id: "market-share", title: "Market Share", group: "Order Flow", icon: "◔", endpoint: "market-share", view: "marketShare", controls: ["mode", "date", "tickerOptional", "shareMode", "shareView", "shareChart"], liveMs: 20000, description: "Exchange share in premium, trade count, or volume using an interactive chart." },
    { id: "market-share-table", title: "Market Share Table", group: "Order Flow", icon: "▥", endpoint: "market-share", view: "marketShareTable", controls: ["mode", "date", "tickerOptional"], liveMs: 20000, description: "Detailed per-exchange equity-call, equity-put, and index activity." },

    { id: "exposure-by-expiration", title: "Exposure by Expiration", group: "Exposure", icon: "⊞", endpoint: "exposure-by-expiration", view: "exposureExpiration", controls: ["mode", "date", "ticker", "greek", "representation", "exposureDisplay", "strike"], liveMs: 20000, description: "GEX, DEX, VEX, and CHEX aggregated across expirations with flexible exposure units." },
    { id: "exposure-by-strike", title: "Exposure by Strike", group: "Exposure", icon: "⊟", endpoint: "exposure-by-strike", view: "exposureStrike", controls: ["mode", "date", "ticker", "greek", "representation", "exposureDisplay", "expiry"], liveMs: 20000, description: "Net Greek exposure across strikes with expiration filtering and an underlying-price marker." },
    { id: "exposure-forecast", title: "Exposure Forecast", group: "Exposure", icon: "✦", endpoint: null, view: "forecast", controls: ["mode", "date", "ticker"], liveMs: 20000, description: "Requires market-data's licensed forecast output." },
    { id: "heat-map", title: "Heat Map", group: "Exposure", icon: "▦", endpoint: "heat-map", view: "heatMap", controls: ["mode", "date", "ticker", "heatMetric", "heatAxes"], liveMs: 20000, description: "Expiration × strike map of exposure, open interest, premium, volume, and Greek metrics." },
    { id: "iv-rank", title: "Implied Volatility Rank", group: "Exposure", icon: "≈", endpoint: "iv-rank", view: "ivRank", controls: ["ticker", "lookback", "maturity", "contractTypeOptional"], liveMs: 60000, description: "Call and put IV rank over a customizable historical lookback and maturity window." },
    { id: "interval-map", title: "Interval Map", group: "Exposure", icon: "⁙", endpoint: "interval-map", view: "intervalMap", controls: ["mode", "date", "ticker", "period", "greek", "intervalValueMode", "strikePadding", "expiry", "minStrike", "maxStrike"], liveMs: 20000, description: "Time-bucketed option exposure with net coloring and an underlying-price overlay." },
    { id: "max-pain", title: "Max Pain", group: "Exposure", icon: "◇", endpoint: "max-pain", view: "maxPain", controls: ["mode", "date", "ticker", "expiry"], liveMs: 30000, description: "Call and put intrinsic value by strike with max-pain and underlying-price markers." },
    { id: "max-pain-over-time", title: "Max Pain / Time", group: "Exposure", icon: "⌁", endpoint: "max-pain-over-time", view: "maxPainTime", controls: ["mode", "date", "ticker"], liveMs: 30000, description: "Max-pain levels across upcoming expirations for the selected session." },
    { id: "net-drift", title: "Net Drift", group: "Exposure", icon: "⌁", endpoint: "net-drift", view: "netDrift", controls: ["mode", "date", "ticker", "expiry", "period", "moneyType", "strike", "driftNet", "driftBands", "driftUnderlying"], liveMs: 12000, description: "Bullish vs bearish premium flow with underlying price and net-volume sentiment." }
  ];
  const FILTER_GROUP_TOOLS=new Set(['equity-prints','exchange-notifications','order-flow-consolidated','contract-statistics','contract-trade-side-statistics','exposure-by-strike','exposure-by-expiration','gainers-losers','heat-map','market-share','market-share-table','net-drift']);

  const CONTROL_OPTIONS = {
    period: PERIOD_OPTIONS,
    greek: [["CHARM", "Charm (CHEX)"], ["DELTA", "Delta (DEX)"], ["GAMMA", "Gamma (GEX)"], ["VANNA", "Vanna (VEX)"]],
    representation: [["PER_ONE_DOLLAR_MOVE", "Per $1 Move"], ["RAW", "Per 1 Unit"], ["PER_ONE_PERCENT_MOVE", "Per 1% Move"]],
    moneyType: [["", "All moneyness"], ["OTM", "OTM"], ["ATM", "ATM"], ["ITM", "ITM"]],
    tradeType: [["", "All trade types"], ["BLOCK", "Blocks"], ["SWEEP", "Sweeps"], ["SPLIT", "Splits"]],
    tradeSide: [["", "All sides"], ["ABOVE_ASK", "Above Ask"], ["ASK", "Ask"], ["MID_MARKET", "Mid-market"], ["BID", "Bid"], ["BELOW_BID", "Below Bid"]],
    printType: [["", "Lit + dark"], ["DARK_POOL", "Dark pool"], ["LIT_POOL", "Lit pool"]],
    notificationType: [["", "All events"],...NOTIFICATION_TYPES.map(type=>[type,type.replaceAll("_"," ")])],
    sector: [["", "All sectors"], ["TECHNOLOGY", "Technology"], ["FINANCIAL_SERVICES", "Financial services"], ["HEALTHCARE", "Healthcare"], ["ENERGY", "Energy"], ["CONSUMER_CYCLICAL", "Consumer cyclical"], ["CONSUMER_DEFENSIVE","Consumer defensive"], ["COMMUNICATION_SERVICES","Communication services"], ["BASIC_MATERIALS","Basic materials"], ["INDUSTRIALS", "Industrials"], ["REAL_ESTATE", "Real estate"], ["UTILITIES", "Utilities"], ["NOT_APPLICABLE","Not applicable"]],
    mapGroup: [["SECTOR","Sector"],["INDUSTRY","Industry"],["NONE","Ungrouped"]],
    chartType: PRICE_CHART_TYPES,
    levelMetric: [["price", "Price"], ["notionalValue", "Notional"], ["size", "Share volume"], ["tradeCount", "Trade count"]],
    sideMetric: [["PREMIUM", "Premium"], ["VOLUME", "Volume"], ["TRADE_COUNT", "Trade count"]],
    rankMetric: [["bullishPremium", "Bullish premium"], ["bearishPremium", "Bearish premium"], ["premium", "Total premium"], ["volume", "Volume"]],
    shareMetric: [["Premium", "Premium"], ["Volume", "Volume"], ["TradeCount", "Trade count"]],
    shareBucket: [["total", "Total"], ["equityCall", "Equity calls"], ["equityPut", "Equity puts"], ["index", "Index"]],
    shareChart: [["pie", "Pie"], ["bar", "Bar"]],
    shareMode: MARKET_SHARE_MODES,
    shareView: [["EXCHANGE","Exchange"],["EXCHANGE_GROUP","Exchange group"]],
    exposureDisplay: [["NET", "Net exposure"], ["SPLIT", "Calls + puts"], ["CALL", "Calls"], ["PUT", "Puts"]],
    exposureOrientation: [["HORIZONTAL", "Strikes / expirations on X"], ["VERTICAL", "Strikes / expirations on Y"]],
    intervalValueMode: [["VALUE", "Value"], ["DIFFERENCE", "Difference"]],
    heatMetric: HEAT_METRICS.map(metric=>[metric.apiName,metric.label]),
    heatAxes: [["NORMAL","Expirations on X"],["INVERTED","Strikes on X"]],
    driftNet: [["HIDE","Hidden"],["SHOW","Shown"]], driftBands: [["HIDE","Hidden"],["SHOW","Shown"]], driftUnderlying: [["SHOW","Shown"],["HIDE","Hidden"]],
    contractType: [["CALL", "Call"], ["PUT", "Put"]],
    contractTypeOptional: [["", "Calls + puts"], ["CALL", "Calls"], ["PUT", "Puts"]]
  };

  const CONTROL_META = {
    mode: ["Session", "select", [["latest", "Latest / live"], ["historical", "Historical snapshot"]]],
    date: ["Session date", "date"], ticker: ["Instrument", "select", instrumentChoices(), "QQQ"], tickerOptional: ["Instrument", "select", [["", "All instruments"], ...instrumentChoices()], ""],
    period: ["Interval", "select"], greek: ["Exposure", "select"], representation: ["Units", "select"],
    moneyType: ["Moneyness", "select"], tradeType: ["Trade type", "select"], printType: ["Venue", "select"],
    notificationType: ["Event type", "select"], tradeSide:["Side","select"], sector: ["Sector", "select"], industry:["Industry","text",null,""], chartType: ["Chart", "select"],
    levelMetric: ["Sort selected levels by", "select"], sideMetric: ["Metric", "select"], rankMetric: ["Rank by", "select"],
    shareMetric: ["Metric", "select"], shareBucket: ["Bucket", "select"], shareChart: ["Chart", "select"], heatMetric: ["Data mode", "select"],
    shareMode: ["Data mode", "select"], shareView: ["View", "select"],
    heatAxes: ["Axes", "select"],
    driftNet: ["Net premium", "select"], driftBands: ["Confidence bands", "select"], driftUnderlying: ["Underlying", "select"],
    mapGroup: ["Group by", "select"],
    exposureDisplay: ["Display", "select"], exposureOrientation: ["Orientation", "select"], intervalValueMode: ["Representation", "select"], strikePadding: ["Strike padding", "number", null, "5"], topLevels: ["Top levels", "number", null, "50"],
    expiry: ["Expiration", "date"], strike: ["Strike", "number"], minStrike: ["Min strike", "number"], maxStrike: ["Max strike", "number"],
    contractType: ["Contract", "select"], contractTypeOptional: ["Contract", "select"], osi: ["OSI (optional)", "text", null, ""],
    lookback: ["Lookback days", "number", null, "365"], maturity: ["Maturity days", "number", null, "30"],
    rangeStart: ["From", "date"], rangeEnd: ["Through", "date"]
  };

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toolMap = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
  const toolView = q("#toolView");
  const dashboard = q("#dashboard");
  const library = q("#toolLibrary");
  const scrim = q("#libraryScrim");
  let activeTool = null;
  let toolPayload = null;
  let tableRows = [];
  let tableColumns = null;
  let tableRuntime = null;
  let tableSort = { key: null, direction: 1 };
  let toolCursor = null;
  let pollTimer = null;
  let activeController = null;
  let toolRequestId = 0;
  let activeChartReset = null;
  let activeChartDispose = null;
  let activeChartUpdate = null;
  let storedWindows=[];try{storedWindows=JSON.parse(gexStorage.getItem(`gex-data-chart-windows:${VIEW_PARAMETERS.get('instance')||'standalone'}`)||'[]');}catch{}
  const chartWindows = new Map(Array.isArray(storedWindows)?storedWindows:[]);
  const snapshotSelections = new Map();
  const snapshotKey=tool=>`${tool.id}|${getControl("mode")}|${getControl("date")}|${getControl("ticker")}`;
  const instanceKey=VIEW_PARAMETERS.get('instance')||'standalone';
  const controlsStorageKey=`gex-data-tool-controls:${instanceKey}`;
  const groupsStorageKey=`gex-data-tool-groups:${instanceKey}`;
  let frameVisible=true,toolGroupIds={};
  try{toolGroupIds=JSON.parse(gexStorage.getItem(groupsStorageKey)||'{}');}catch{}
  let savedToolControls={};
  try { savedToolControls=JSON.parse(gexStorage.getItem(controlsStorageKey)||"{}"); } catch { /* Invalid saved view does not affect source data. */ }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function todayOffset(days = 0) {
    const date = new Date(Date.now() + days * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function openLibrary(open = true) {
    library.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    library.setAttribute("aria-hidden", String(!open));
    q("#openLibrary").setAttribute("aria-expanded", String(open));
    if (open) q("#toolSearch").focus();
  }

  function renderToolNav(filter = "") {
    const nav = q("#toolNav");
    nav.replaceChildren();
    const normalized = filter.trim().toLowerCase();
    const boardGroup = element("div", "tool-nav-group");
    boardGroup.append(element("h3", "", "Workspace"));
    const board = element("button", "tool-nav-item", "");
    board.type = "button"; board.dataset.tool = "kes-board";
    board.append(element("span", "nav-icon", "▦"), element("span", "", "Overview"), element("small", "", "6 panels"));
    board.addEventListener("click", showBoard);
    boardGroup.append(board); nav.append(boardGroup);
    for (const groupName of ["Equities", "Order Flow", "Exposure"]) {
      const tools = TOOL_DEFINITIONS.filter((tool) => tool.group === groupName && (!normalized || `${tool.title} ${tool.description}`.toLowerCase().includes(normalized)));
      if (!tools.length) continue;
      const group = element("div", "tool-nav-group");
      group.append(element("h3", "", groupName));
      for (const tool of tools) {
        const button = element("button", `tool-nav-item${activeTool?.id === tool.id ? " active" : ""}`);
        button.type = "button"; button.dataset.tool = tool.id;
        button.append(element("span", "nav-icon", tool.icon), element("span", "", tool.title), element("small", "", tool.liveMs <= 10000 ? "live" : ""));
        button.addEventListener("click", () => showTool(tool.id));
        group.append(button);
      }
      nav.append(group);
    }
  }

  function makeControl(id) {
    const [label, type, inlineOptions, defaultValue] = CONTROL_META[id];
    const optionalTicker=id==='ticker'&&['equity-prints','order-flow-consolidated'].includes(activeTool?.id);
    const wrap = element("div", "control");
    const labelNode = element("label", "", label); labelNode.htmlFor = `control-${id}`;
    let input;
    if(type==='select'&&['moneyType','tradeSide','notificationType','tradeType','sector'].includes(id)){
      const options=[...(inlineOptions||CONTROL_OPTIONS[id]||[]),...(id==='sector'?[['UNKNOWN','Unknown']]:[])];
      input=multiChoiceDropdown({choices:options.filter(([value])=>value),label,emptyLabel:options.find(([value])=>!value)?.[1]||'All'});
    }else if (type === "select") {
      input = document.createElement("select");
      const options = inlineOptions || CONTROL_OPTIONS[id] || [];
      if(optionalTicker)input.add(new Option('All instruments',''));
      for (const [value, optionLabel] of options) input.add(new Option(optionLabel, value));
    } else {
      input = document.createElement("input"); input.type = type;
      if (type === "number") input.step = "any";
      if (type === "text") input.autocomplete = "off";
    }
    if (defaultValue != null) input.value = defaultValue;
    if (id === "period" && activeTool?.id === "interval-map") input.value = "5m";
    if(optionalTicker)input.value='';
    input.id = `control-${id}`; input.dataset.control = id;
    if (id === "ticker" || id === "tickerOptional") input.placeholder = id === "ticker" ? "QQQ" : "All tickers";
    if (id === "osi") input.placeholder = "Auto-discover recent contract";
    if (id === "rangeStart") input.value = todayOffset(-7);
    if (id === "rangeEnd") input.value = todayOffset(0);
    if (id === "date") input.value = todayOffset(0);
    if (id === "greek") input.value = "GAMMA";
    if (id === "representation") input.value = "PER_ONE_PERCENT_MOVE";
    if (id === "shareMode") input.value = "EQUITY_VOLUME";
    if (id === "heatMetric") input.value = "NET_GAMMA_EXPOSURE";
    wrap.append(labelNode, input);
    return wrap;
  }

  function getControl(id) {
    if(activeTool?.id==='iv-rank'&&['mode','date'].includes(id))return id==='mode'?'latest':'';
    const control=q(`[data-control="${id}"]`,q('#toolControls')),own=control?.dataset.overrideOwn??control?.value??'';
    if(!['ticker','tickerOptional','expiry','mode','date'].includes(id))return own;
    const {page,global}=getFilterOverrides(),key=id==='ticker'||id==='tickerOptional'?'tickers':id==='expiry'?'expirationDate':'sessionDate',result=resolveFilterOverride({toolValue:null,pageValue:page[key],globalValue:global[key],isTicker:key==='tickers'});
    if(result.type==='NONE')return own;if(key==='tickers')return result.value[0];if(id==='mode')return 'historical';return result.value;
  }
  function setControl(id, value) { const control = q(`[data-control="${id}"]`, q("#toolControls")); if (control) {if('overrideOwn' in control.dataset)control.dataset.overrideOwn=String(value);else if(id==='ticker'||id==='tickerOptional')setChoiceValue(control,value);else control.value=value;} }

  function reflectFilterOverrides(){
    const {page,global}=getFilterOverrides();for(const control of qa('[data-control]',q('#toolControls'))){const id=control.dataset.control;if(!['ticker','tickerOptional','expiry','mode','date'].includes(id))continue;const key=id==='ticker'||id==='tickerOptional'?'tickers':id==='expiry'?'expirationDate':'sessionDate',result=resolveFilterOverride({toolValue:null,pageValue:page[key],globalValue:global[key],isTicker:key==='tickers'});
      if(result.type==='NONE'){if('overrideOwn' in control.dataset){if(key==='tickers')setChoiceValue(control,control.dataset.overrideOwn);else control.value=control.dataset.overrideOwn;delete control.dataset.overrideOwn;control.disabled=false;control.title='';control.closest('.control').classList.remove('filter-overridden');}}else{if(!('overrideOwn' in control.dataset))control.dataset.overrideOwn=control.value;if(key==='tickers')setChoiceValue(control,result.value[0]);else control.value=id==='mode'?'historical':result.value;control.disabled=true;control.title=`Controlled by ${result.type.toLowerCase()} tool filters`;control.closest('.control').classList.add('filter-overridden');}}
  }

  function syncDateControl() {
    const mode = getControl("mode");
    const date = q('[data-control="date"]', q("#toolControls"));
    if (date) date.closest(".control").hidden = mode !== "historical";
    updateLiveState();
  }

  function updateLiveState() {
    const badge = q("#toolLiveState");
    const pinned=activeTool&&snapshotSelections.has(snapshotKey(activeTool));
    const latest = getControl("mode") !== "historical";
    const live = !pinned && latest && toolMarketOpen() && q('#toolError')?.hidden!==false;
    badge.classList.toggle("live", live);
    const failed=q('#toolError')?.hidden===false;
    q("b", badge).textContent = failed?'DATA UNAVAILABLE':pinned ? "HISTORICAL SNAPSHOT" : activeTool?.id==='iv-rank'?'ROLLING SERIES':live ? "AUTO UPDATE" : latest ? "LATEST SESSION" : "HISTORICAL";
    if(EMBEDDED)parent.postMessage({type:'gex-data-status',paused:!!pinned,failed,message:pinned?'Historical snapshot paused':failed?'Data unavailable':'Connected data workspace'},location.origin);
  }

  function renderControls(tool) {
    const holder = q("#toolControls"); holder.replaceChildren();
    for (const id of tool.controls) { holder.append(makeControl(id)); if(id==="exposureDisplay")holder.append(makeControl("exposureOrientation")); }
    for(const input of qa("[data-control]",holder)){const value=savedToolControls[tool.id]?.[input.dataset.control];if(value!=null)setControl(input.dataset.control,value);}
    if(VIEW_PARAMETERS.get('instance')&&!savedToolControls[tool.id])for(const [key,value] of VIEW_PARAMETERS)if(key.startsWith('c_'))setControl(key.slice(2),value);
    if(EMBEDDED){const order=tool.id==='net-drift'?['ticker','tickerOptional','date','strike','expiry','moneyType','period']:tool.id==='interval-map'?['ticker','date','expiry','period','strikePadding','greek']:['ticker','tickerOptional','date','expiry','greek','representation'];for(const control of qa('.control',holder).sort((a,b)=>{const aId=q('[data-control]',a)?.dataset.control,bId=q('[data-control]',b)?.dataset.control;return (order.includes(aId)?order.indexOf(aId):100)-(order.includes(bId)?order.indexOf(bId):100);}))holder.append(control);}
    reflectFilterOverrides();syncDateControl();
    holder.onchange = onControlsChanged;
    holder.oninput = onControlsChanged;
    const actions=element('div','embedded-actions');
    for(const [label,text,action] of [['Refresh','↻',()=>loadActiveTool()],['Reset Zoom','⟲',()=>activeChartReset?.()],['Filter Groups','▽',event=>showFilterGroups(event.currentTarget,{toolId:tool.id,activeIds:toolGroupIds[tool.id]||[],onChange:ids=>{toolGroupIds[tool.id]=ids;gexStorage.setItem(groupsStorageKey,JSON.stringify(toolGroupIds));loadActiveTool();}})],['Tool Settings','⋮',event=>popup(event.currentTarget,'Tool Settings',el=>{for(const [name,fn] of [['Tool Configuration',()=>showToolConfiguration(event.currentTarget)],['Reset Zoom',()=>activeChartReset?.()],['Export CSV',exportCsv],['Reset to Default Settings',click=>confirmLocalAction('Reset to Default Settings','Reset this tool and detach its Filter Groups?',()=>{delete savedToolControls[tool.id];delete toolGroupIds[tool.id];gexStorage.setItem(controlsStorageKey,JSON.stringify(savedToolControls));gexStorage.setItem(groupsStorageKey,JSON.stringify(toolGroupIds));tableRuntime?.reset();chartWindows.delete(tool.id);gexStorage.setItem(`gex-data-chart-windows:${instanceKey}`,JSON.stringify([...chartWindows]));if(tool.id==='market-map')gexStorage.removeItem(`gex-data-market-map-camera:${instanceKey}`);snapshotSelections.delete(snapshotKey(tool));if(EMBEDDED)parent.postMessage({type:'gex-data-minute',minute:null},location.origin);renderControls(tool);saveToolControls();loadActiveTool();},click)]]){const b=element('button','',name);b.type='button';b.addEventListener('click',event=>{el.remove();fn(event);});el.append(b);}})]]){const b=element('button','',text);b.type='button';b.title=label;b.setAttribute('aria-label',label);b.addEventListener('click',action);actions.append(b);}holder.append(actions);
    if(!FILTER_GROUP_TOOLS.has(tool.id))actions.querySelector('[aria-label="Filter Groups"]')?.remove();
  }

  function saveToolControls(){
    if(activeTool){savedToolControls[activeTool.id]=Object.fromEntries(qa("[data-control]",q("#toolControls")).map(input=>[input.dataset.control,input.dataset.overrideOwn??input.value]));try{gexStorage.setItem(controlsStorageKey,JSON.stringify(savedToolControls));}catch{}if(EMBEDDED)parent.postMessage({type:'gex-data-tool-state',controls:savedToolControls[activeTool.id]},location.origin);}
  }
  window.addEventListener('pagehide',()=>{saveToolControls();try{gexStorage.setItem(`gex-data-chart-windows:${instanceKey}`,JSON.stringify([...chartWindows]));}catch{}});
  function onControlsChanged(event) {
    if(event?.target?.dataset.control==='sector')setControl('industry','');
    if(EMBEDDED&&event?.target?.dataset.control==='date'){setControl('mode',event.target.value?'historical':'latest');syncDateControl();}
    saveToolControls();
    if (event?.target?.dataset.control === "mode") syncDateControl();
    clearTimeout(onControlsChanged.timer);
    onControlsChanged.timer = setTimeout(() => loadActiveTool(), 180);
  }

  function showBoard() {
    clearTimeout(onControlsChanged.timer);
    activeTool = null; clearTimeout(pollTimer); activeController?.abort();
    toolView.hidden = true; dashboard.hidden = false; location.hash = ""; openLibrary(false); renderToolNav(q("#toolSearch").value);
    q(".page-name").textContent = "GEX DATA";
    workspaceController?.visibility(true);
  }

  async function showTool(id) {
    const tool = toolMap.get(id); if (!tool) return;
    clearTimeout(onControlsChanged.timer);
    activeTool = tool; toolPayload = null; toolCursor = null; tableRows = [];resetStage();
    workspaceController?.visibility(false);
    q("#tableSearch").value="";
    dashboard.hidden = true; toolView.hidden = false; openLibrary(false); location.hash = `tool=${tool.id}`;
    q("#toolGroup").textContent = tool.group.toUpperCase(); q("#toolTitle").textContent = tool.title; q("#toolDescription").textContent = tool.description;
    q(".page-name").textContent = tool.title.toUpperCase(); renderControls(tool); renderToolNav(q("#toolSearch").value);
    const snapshot=Number(VIEW_PARAMETERS.get('snapshot'));if(VIEW_PARAMETERS.has('snapshot')&&Number.isFinite(snapshot)&&snapshot>946684800000&&snapshot<=Date.now()&&['heat-map','exposure-by-strike','exposure-by-expiration','market-map'].includes(tool.id)&&!snapshotSelections.has(snapshotKey(tool)))snapshotSelections.set(snapshotKey(tool),snapshot);
    await loadActiveTool();
  }

  function requestBase() {
    const body = {};
    if (getControl("mode") === "historical" && getControl("date")) body.sessionDate = getControl("date");
    else if(activeTool?.id!=='iv-rank'&&apiStatus.market?.sessionDate)body.sessionDate=activeTool?.group==='Equities'?apiStatus.market.sessionDate:(apiStatus.market.optionsSessionDate||apiStatus.market.sessionDate);
    return body;
  }

  function maybeFilter(body, key, value, plural = false) {
    if (value === "" || value == null) return;
    body.filter ||= {}; body.filter[key] = plural ? [value] : value;
  }

  function buildRequest(tool) {
    const body = requestBase();
    const ticker = String(getControl("ticker") || getControl("tickerOptional") || "").trim().toUpperCase();
    if (ticker) maybeFilter(body, tool.id === "market-share" || tool.id === "market-share-table" || tool.id === "gainers-losers" || tool.id === "exchange-notifications" ? "tickers" : "ticker", ticker, ["market-share", "market-share-table", "gainers-losers", "exchange-notifications"].includes(tool.id));
    const period = getControl("period"); if (period) body.aggregationPeriod = period;
    const selections=id=>String(getControl(id)||'').split(/[,\s]+/).filter(Boolean);
    if (getControl("moneyType")) maybeFilter(body, "moneyTypes", selections('moneyType').map(value=>({ATM:'AT_THE_MONEY',ITM:'IN_THE_MONEY',OTM:'OUT_OF_THE_MONEY'}[value]||value)));
    if (getControl("tradeType")) maybeFilter(body, "tradeConsolidationTypes", selections('tradeType'));
    if (getControl("tradeSide")) maybeFilter(body, "tradeSideCodes", selections('tradeSide'));
    if (getControl("printType")) maybeFilter(body, "equityPrintTypes", getControl("printType"), true);
    if (getControl("notificationType")) maybeFilter(body, "types", selections('notificationType'));
    if (getControl("sector")) maybeFilter(body, "sectors", selections('sector'));
    if (getControl('industry')) maybeFilter(body,'industries',getControl('industry').split(',').map(value=>value.trim().toUpperCase().replaceAll(' ','_')).filter(Boolean));
    if (getControl("expiry")) maybeFilter(body, tool.id === "interval-map" || tool.id === "max-pain" || tool.id === "option-price-over-time" ? "expirationDate" : "expirationDates", getControl("expiry"), tool.id !== "interval-map" && tool.id !== "max-pain" && tool.id !== "option-price-over-time");
    if (getControl("strike")) maybeFilter(body, tool.id === "option-price-over-time" ? "strikePrice" : "strikePrices", Number(getControl("strike")), tool.id !== "option-price-over-time");
    if (getControl("minStrike")) maybeFilter(body, "minStrikePrice", Number(getControl("minStrike")));
    if (getControl("maxStrike")) maybeFilter(body, "maxStrikePrice", Number(getControl("maxStrike")));
    if (tool.id === "dark-pool-levels") {delete body.sessionDate;body.sessionDateRange = { startDate: getControl("rangeStart"), endDate: getControl("rangeEnd") };}
    if (tool.id.startsWith("exposure-by-")) { body.greekMode = getControl("greek"); body.representationMode = getControl("representation"); }
    if (tool.id === "interval-map") body.greekMode = getControl("greek");
    if (tool.id === "heat-map") body.dataMode = getControl("heatMetric");
    if (tool.id === "contract-trade-side-statistics") body.dataMode = getControl("sideMetric");
    if (tool.id === "iv-rank") {
      delete body.sessionDate; body.lookBackPeriod = Number(getControl("lookback")); body.maturity = Number(getControl("maturity"));
      if (getControl("contractTypeOptional")) maybeFilter(body, "contractTypes", getControl("contractTypeOptional"), true);
    }
    if (["equity-prints", "exchange-notifications", "order-flow-consolidated"].includes(tool.id)) body.size = 100;
    if (tool.id === "order-flow-consolidated") { body.includeStatistics = true; body.includeComprisingTrades = true; }
    if (tool.id === "option-price-over-time") {
      const osi = getControl("osi").trim().toUpperCase();
      body.filter = osi ? { osi } : { ticker, expirationDate: getControl("expiry"), strikePrice: Number(getControl("strike")), contractType: getControl("contractType") };
    }
    if (toolCursor) body.searchAfter = toolCursor;
    const override=getFilterOverrides(),tickerOverride=resolveFilterOverride({toolValue:null,pageValue:override.page.tickers,globalValue:override.global.tickers,isTicker:true}),expiryOverride=resolveFilterOverride({toolValue:null,pageValue:override.page.expirationDate,globalValue:override.global.expirationDate}),dateOverride=resolveFilterOverride({toolValue:null,pageValue:override.page.sessionDate,globalValue:override.global.sessionDate});
    if(tickerOverride.type!=='NONE'&&tool.id!=='market-map'){body.filter||={};delete body.filter.ticker;delete body.filter.tickers;const multiple=['market-share','market-share-table','gainers-losers','exchange-notifications','contract-statistics','contract-trade-side-statistics','net-drift','order-flow-consolidated','equity-prints'].includes(tool.id);body.filter[multiple?'tickers':'ticker']=multiple?tickerOverride.value:tickerOverride.value[0];}
    if(expiryOverride.type!=='NONE'&&!['dark-flow','dark-pool-levels','equity-prints','exchange-notifications','stock-price-over-time','market-map','iv-rank','max-pain-over-time','exposure-forecast'].includes(tool.id)){body.filter||={};delete body.filter.expirationDate;delete body.filter.expirationDates;Object.assign(body.filter,expirationFilterForTool(tool.id,expiryOverride.value));}
    if(dateOverride.type!=='NONE'&&tool.id!=='iv-rank'){if(tool.id==='dark-pool-levels')body.sessionDateRange={startDate:dateOverride.value,endDate:dateOverride.value};else body.sessionDate=dateOverride.value;}
    const attached=FILTER_GROUP_TOOLS.has(tool.id)?getFilterGroups().filter(group=>(toolGroupIds[tool.id]||[]).includes(group.id)&&(group.type||'OPTION_TRADES_UNCONSOLIDATED')===filterGroupTypeForTool(tool.id)):[];if(attached.length)body.filterExpression=normalizeAPIExpression({conjunction:'AND',filters:attached.map(group=>group.expression)});
    if(tool.id==='option-price-over-time'&&body.filter?.osi){if(tickerOverride.type!=='NONE'||expiryOverride.type!=='NONE')throw Error('Clear page/global ticker and expiration overrides when selecting an exact OSI contract.');body.filter={osi:body.filter.osi};}
    return body;
  }

  async function toolFetch(endpoint, body, signal = activeController?.signal) {
    const response = await fetch(`/api/gex-data/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const payload = await response.json().catch(() => ({ error: "Invalid response from the local gateway" }));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function openTradeDetail({title,preview,filter,timeRange,individual=false}){
    const current=activeTool,base=buildRequest(current);let request={...requestBase(),filter:{...base.filter,...filter},...(base.filterExpression?{filterExpression:base.filterExpression}:{}),sort:{field:'PREMIUM',direction:'DESCENDING'},size:100,includeComprisingTrades:true};
    if(timeRange){delete request.sessionDate;request.timeRange=timeRange;}
    if(individual)request=optionTradeDetailRequest({base,filter,timeRange});
    showDataDialog(title,dialog=>{
      dialog.classList.add('trade-detail-dialog');dialog.append(element('p','',preview));const status=element('p','workspace-note','Loading actual licensed trades…'),wrap=element('div','trade-detail-scroll'),table=document.createElement('table'),more=element('button','','Load next 100');more.type='button';more.hidden=true;wrap.append(table);dialog.append(status,wrap,more);let rows=[],cursor;
      const view=createTableView({table,maxRows:1000});
      const load=async()=>{more.disabled=true;try{const response=await toolFetch(individual?OPTION_TRADE_DETAIL_ENDPOINT:'order-flow-consolidated',{...request,...(cursor?{searchAfter:cursor}:{})});rows.push(...(individual?unconsolidatedTradeRows(response):response.data||[]));cursor=response.nextSearchAfter;view.setRows(rows,{columns:individual?UNCONSOLIDATED_COLUMNS:CONSOLIDATED_COLUMNS,toolId:'detail',sortKey:'premium'});status.textContent=`${rows.length} actual ${individual?'individual prints':'trades'} · largest premium first · values are not inferred from chart buckets`;more.hidden=!cursor;}catch(error){status.textContent=error.message;}finally{more.disabled=false;}};more.addEventListener('click',load);dialog.addEventListener('close',()=>view.destroy());load();
    });
  }

  async function discoverContract(body) {
    const ticker = String(body.filter?.ticker || getControl("ticker") || "QQQ").toUpperCase();
    const contractFilter={ticker,...(getControl('expiry')?{expirationDates:[getControl('expiry')]}:{}),...(getControl('strike')?{strikePrices:[Number(getControl('strike'))]}:{}),...(getControl('contractType')?{contractTypes:[getControl('contractType')]}:{})};
    const discovery = await toolFetch("order-flow-consolidated", { ...requestBase(), filter: contractFilter, size: 1 });
    const row = discovery.data?.[0];
    if (!row) throw new Error(`No recent ${ticker} option contract is available. Enter an OSI or contract fields.`);
    if(row.contractType)setControl("contractType",row.contractType);
    if(row.expirationDate)setControl("expiry",row.expirationDate);
    if(row.strikePrice!=null)setControl("strike",row.strikePrice);
    const osi = row.osi || row.optionSymbol || row.contractSymbol;
    if (osi) { setControl("osi", osi); return { ...body, filter: { osi } }; }
    const filter = { ticker, expirationDate: row.expirationDate, strikePrice: row.strikePrice, contractType: row.contractType };
    if (!filter.expirationDate || !Number.isFinite(Number(filter.strikePrice)) || !filter.contractType) throw new Error("The latest flow row did not include a complete contract identifier.");
    setControl("expiry", filter.expirationDate); setControl("strike", filter.strikePrice); setControl("contractType", filter.contractType);
    return { ...body, filter };
  }

  async function discoverExpiration(body) {
    const ticker = String(getControl("ticker") || "QQQ").toUpperCase();
    const response = await toolFetch("exposure-by-strike", { ...requestBase(), greekMode: "GAMMA", representationMode: "RAW", filter: { ticker } });
    const map = response.data?.[ticker]?.exposureMap || response.data?.exposureMap || {};
    const expirationDate = Object.keys(map).sort()[0];
    if (!expirationDate) throw new Error(`No expiration is available for ${ticker} in this session.`);
    setControl("expiry", expirationDate); return { ...body, filter: { ...(body.filter || {}), ticker, expirationDate } };
  }


  async function loadToolPayload(tool) {
    if (tool.view === "forecast") return {unavailable:true};
    let body = buildRequest(tool);
    const effectiveSessionDate=body.sessionDate||apiStatus.market?.optionsSessionDate;
    const snapshotTools=["heat-map","exposure-by-strike","exposure-by-expiration","market-map"],snapshotTime=snapshotTools.includes(tool.id)?snapshotSelections.get(snapshotKey(tool)):null;
    if(snapshotTime){delete body.sessionDate;body.snapshotTime=new Date(completedMinuteSnapshot(snapshotTime)).toISOString();}
    if (tool.id === "option-price-over-time" && !getControl("osi") && (!getControl("expiry") || !getControl("strike"))) body = await discoverContract(body);
    if (tool.id === "max-pain" && !getControl("expiry")) body = await discoverExpiration(body);
    if(snapshotTools.includes(tool.id)){
      const [result,price]=await Promise.all([toolFetch(tool.endpoint,body),toolFetch("stock-price-over-time",{...requestBase(),aggregationPeriod:"1m",filter:{ticker:tool.id==='market-map'?'SPY':getControl("ticker")}})]);
      const prices=parsePrices(price),sessionDate=effectiveSessionDate;
      const entries=tool.id!=='market-map'&&sessionDate?snapshotControlTimeline(prices,{sessionDate,schedule:equityOptionSnapshotSchedule(getControl('ticker'),sessionDate,apiStatus.market?.calendar)}):prices.map(row=>({time:row.time}));
      const timeline=entries.map(entry=>entry.time),selected=snapshotTime??timeline.at(-1),matching=timeline.length?selectedSnapshotSpot(prices,snapshotTime?completedMinuteSnapshot(selected):selected):null;
      return {...result,_timeline:timeline,_snapshotEntries:entries,_snapshotTime:selected,_spot:matching?.available?matching.spot:undefined};
    }
    if (["interval-map", "max-pain-over-time", "option-price-over-time"].includes(tool.id)) {
      const osiRoot=tool.id==='option-price-over-time'?String(body.filter?.osi||'').replaceAll(' ','').match(/^([A-Z.]+)\d{6}[CP]\d{8}$/)?.[1]:null;
      const underlying=osiRoot?({SPXW:'SPX',NDXP:'NDX'}[osiRoot]||osiRoot):String(body.filter?.ticker||getControl("ticker")||"QQQ").toUpperCase();
      const [interval, price] = await Promise.all([
        toolFetch(tool.endpoint, body),
        toolFetch("stock-price-over-time", { ...requestBase(), aggregationPeriod: body.aggregationPeriod || "1m", filter: { ticker: underlying } }).catch(() => ({ data: {} }))
      ]);
      return { ...interval, stock: price.data || {} };
    }
    return toolFetch(tool.endpoint, body);
  }

  async function loadActiveTool({append=false}={}) {
    if(!activeTool||window.__gexDataActive===false||!frameVisible)return;
    const tool=activeTool,requestId=++toolRequestId;
    if(!append)toolCursor=null;
    clearTimeout(pollTimer);pollTimer=null;activeController?.abort();activeController=new AbortController();
    // Keep the existing chart/table usable during both automatic and manual
    // refreshes. Network activity must not cover it with a loading screen.
    toolView.setAttribute("aria-busy","true");q("#toolError").hidden=true;
    try{
      const payload=await loadToolPayload(tool);
      if(requestId!==toolRequestId||activeTool!==tool)return;
      if(append&&Array.isArray(payload.data)){
        payload.data=[...tableRows,...payload.data];
        // The licensed flow endpoint only includes aggregate statistics on page1.
        // Pagination must retain that session/filter aggregate, not infer totals
        // from the currently loaded subset or remove its header.
        if(payload.statistics==null&&toolPayload?.statistics!=null)payload.statistics=toolPayload.statistics;
      }
      toolPayload=payload;toolCursor=payload.nextSearchAfter||null;renderToolPayload(tool,payload,{refresh:true});renderSnapshotControl(payload);
      updateToolTimestamp(tool,payload);
      saveToolControls();updateLiveState();
    }catch(error){
      if(requestId===toolRequestId&&activeTool===tool&&error.name!=="AbortError"){q("#toolError").textContent=error.message;q("#toolError").hidden=false;updateLiveState();if(EMBEDDED)parent.postMessage({type:'gex-data-status',failed:true,message:error.message},location.origin);}
    }finally{
      if(requestId===toolRequestId&&activeTool===tool){toolView.setAttribute("aria-busy","false");schedulePoll();}
    }
  }

  function updateToolTimestamp(tool,payload) {
    const pinned=snapshotSelections.get(snapshotKey(tool));
    const stateLabel=pinned?`completed-minute snapshot ${new Date(completedMinuteSnapshot(pinned)).toLocaleString('en-US',{timeZone:gexTimeZone()})}`:getControl("mode")==="historical"?"snapshot "+getControl("date"):apiStatus.market?.open?"live session":"latest EOD";
    const fetched=payload._gexData?.gatewayFetchedAt;
    q("#toolUpdated").textContent=`${fetched?'Retrieved '+new Date(fetched).toLocaleTimeString('en-US',{timeZone:gexTimeZone()}):'Source time unavailable'} · ${tool.id==='iv-rank'?'Rolling series':payload._gexData?.requestedSessionDate||stateLabel}`;
  }

  function refreshTimeZonePresentation() {
    if(!activeTool||!toolPayload)return;
    renderToolPayload(activeTool,toolPayload);renderSnapshotControl(toolPayload);
    updateToolTimestamp(activeTool,toolPayload);
  }

  function schedulePoll() {
    let requestedDate;try{const request=activeTool?buildRequest(activeTool):{};requestedDate=request.sessionDate??request.sessionDateRange?.endDate??request.sessionDateRange?.startDate;}catch{clearTimeout(pollTimer);pollTimer=null;return;}
    const currentDate=activeTool?.group==='Equities'?apiStatus.market?.sessionDate:(apiStatus.market?.optionsSessionDate||apiStatus.market?.sessionDate);
    if (!activeTool || !frameVisible || window.__gexDataActive===false || document.hidden || getControl("mode") === "historical" || (requestedDate&&currentDate&&requestedDate<currentDate) || snapshotSelections.has(snapshotKey(activeTool)) || !toolMarketOpen()) {clearTimeout(pollTimer);pollTimer=null;return;}
    if(pollTimer!==null)return;
    pollTimer = setTimeout(() => {pollTimer=null;loadActiveTool();}, Math.max(30000,activeTool.liveMs));
  }
  function toolMarketOpen(){return Boolean(activeTool?.group==='Equities'?apiStatus.market?.equitiesOpen:apiStatus.market?.optionsOpen??apiStatus.market?.open);}

  function renderSnapshotControl(payload){
    const timeline=payload._timeline;if(!timeline?.length)return;
    const holder=element("div","snapshot-control"),label=element("b","","Time"),range=document.createElement("input"),output=element("output"),timeSelect=document.createElement('select');timeSelect.className='snapshot-time-select';timeSelect.setAttribute('aria-label','Snapshot time');for(const [value,text]of snapshotTimeOptions(timeline,displayChartTime))timeSelect.add(new Option(text,value));range.type="range";range.min="0";range.max=String(timeline.length-1);range.step="1";range.setAttribute("aria-label","One-minute exposure snapshot");
    range.setAttribute('aria-label','One-minute session snapshot');let selected=timeline.findIndex(time=>time===payload._snapshotTime);if(selected<0)selected=timeline.length-1;range.value=timeSelect.value=String(selected);output.textContent=displayChartTime(timeline[selected]);
    const start=element("span","",displayChartTime(timeline[0])),end=element("span","",displayChartTime(timeline.at(-1))),latest=element("button","","Latest");latest.type="button";latest.addEventListener("click",()=>{snapshotSelections.delete(snapshotKey(activeTool));if(EMBEDDED)parent.postMessage({type:'gex-data-minute',minute:null},location.origin);loadActiveTool();});
    let timer;const select=()=>{timeSelect.value=range.value;output.textContent=displayChartTime(timeline[Number(range.value)]);if(EMBEDDED)parent.postMessage({type:'gex-data-minute',minute:Number(range.value)===timeline.length-1?null:timeline[Number(range.value)]},location.origin);clearTimeout(timer);const tool=activeTool,key=snapshotKey(tool);timer=setTimeout(()=>{if(activeTool!==tool)return;if(Number(range.value)===timeline.length-1)snapshotSelections.delete(key);else snapshotSelections.set(key,timeline[Number(range.value)]);loadActiveTool();},220);};range.addEventListener("input",select);range.addEventListener("change",select);timeSelect.addEventListener('change',()=>{range.value=timeSelect.value;select();});
    holder.append(label,range,timeSelect,latest);const ends=element("div","snapshot-labels");ends.append(start,end);holder.append(ends);q("#toolVisual").append(holder);
  }

  function resetStage() {
    activeChartUpdate=null;
    activeChartDispose?.();activeChartDispose=null;
    tableColumns=null;
    q(".flow-statistics")?.remove();
    q("#toolVisual").replaceChildren(); q("#toolVisual").hidden = true; q("#toolTableWrap").hidden = true; q("#chartToolbar").hidden = true;
    q("#toolTable thead").replaceChildren(); q("#toolTable tbody").replaceChildren(); tableRows = [];
    q("#toolSummary").replaceChildren(); activeChartReset = null;
  }

  function summaryCard(label, value, tone = "") {
    const card = element("div", `summary-card ${tone}`.trim()); card.append(element("span", "", label), element("b", "", value)); return card;
  }

  function setSummary(items) {
    const summary = q("#toolSummary"); summary.replaceChildren(...items.map(([label, value, tone]) => summaryCard(label, value, tone)));
  }

  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function compact(value, money = false) {
    return money?currencyAbbreviated(value,2):abbreviate(value,2);
  }

  function timeLabel(value) {
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: gexTimeZone() });
  }

  function dateLabel(value) {
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: gexTimeZone() });
  }

  function numericEntries(data) {
    return Object.entries(data || {}).filter(([key, row]) => /^\d+$/.test(key) && row && typeof row === "object").sort(([a], [b]) => Number(a) - Number(b));
  }

  function showVisual() { q("#toolVisual").hidden = false; q("#toolTableWrap").hidden = true; q("#chartToolbar").hidden = false; }

  function renderSeriesChart(series, { title = "", independent = false, bars = false, area = false, xFormatter = timeLabel, yMoney = false, markers = [] } = {}) {
    showVisual(); const holder = q("#toolVisual"); holder.replaceChildren();
    const canvas = element("canvas", "tool-chart"); canvas.setAttribute("aria-label", title || `${activeTool.title} interactive chart`);
    const tooltip = element("div", "chart-tooltip"); tooltip.hidden = true;
    const scrubber = element("label", "chart-scrubber"); scrubber.append(element("span", "", "View")); const range = document.createElement("input"); range.type = "range"; scrubber.append(range);
    holder.append(canvas, tooltip, scrubber);
    const maxLength = Math.max(0, ...series.map((item) => item.values.length)); range.min = "0"; range.max = String(Math.max(0, maxLength - 1)); range.value = String(Math.max(0, maxLength - 1));
    const state = { start: 0, end: Math.max(0, maxLength - 1), hover: null, dragX: null, dragStart: null };

    function boundsFor(item, from, to) {
      const values = item.values.slice(from, to + 1).map((point) => point.y).filter(Number.isFinite);
      if (!values.length) return [-1, 1]; let min = Math.min(...values), max = Math.max(...values);
      if (min === max) { min -= Math.abs(min || 1) * .1; max += Math.abs(max || 1) * .1; }
      const pad = (max - min) * .1; return [min - pad, max + pad];
    }

    function draw() {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, rect.width), h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const left = 72, right = w - 26, top = 38, bottom = h - 56, span = Math.max(1, state.end - state.start);
      ctx.font = "10px Aleph, sans-serif"; ctx.fillStyle = themePaint("#8f79a5"); ctx.textAlign = "left"; ctx.fillText(title, left, 21);
      ctx.strokeStyle = themePaint("rgba(105,52,150,.22)"); ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) { const y = top + (bottom - top) * i / 6; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
      for (let i = 0; i <= 6; i++) { const x = left + (right - left) * i / 6; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); }
      const sharedValues = series.flatMap((item) => item.values.slice(state.start, state.end + 1).map((point) => point.y)).filter(Number.isFinite);
      let sharedMin = Math.min(...sharedValues), sharedMax = Math.max(...sharedValues); if (!sharedValues.length) { sharedMin = -1; sharedMax = 1; }
      if (sharedMin === sharedMax) { sharedMin -= 1; sharedMax += 1; } const sharedPad = (sharedMax - sharedMin) * .1; sharedMin -= sharedPad; sharedMax += sharedPad;
      const scales = series.map((item) => independent ? boundsFor(item, state.start, state.end) : [sharedMin, sharedMax]);
      series.forEach((item, seriesIndex) => {
        const [minY, maxY] = scales[seriesIndex]; const visible = item.values.slice(state.start, state.end + 1); if (!visible.length) return;
        const points = visible.map((point, index) => ({ x: left + (right - left) * index / span, y: bottom - (number(point.y) - minY) / (maxY - minY) * (bottom - top), point, index: state.start + index }));
        ctx.strokeStyle = item.color; ctx.fillStyle = item.color; ctx.lineWidth = 2; ctx.lineJoin = "round";
        if (bars) {
          const barWidth = Math.max(2, Math.min(18, (right - left) / Math.max(visible.length, 1) * .64));
          const zeroY = bottom - (0 - minY) / (maxY - minY) * (bottom - top);
          for (const point of points) { ctx.globalAlpha = .82; ctx.fillRect(point.x - barWidth / 2, Math.min(point.y, zeroY), barWidth, Math.max(1, Math.abs(zeroY - point.y))); }
          ctx.globalAlpha = 1;
        } else {
          if (area || item.area) { ctx.globalAlpha = .13; ctx.beginPath(); ctx.moveTo(points[0].x, bottom); points.forEach((point) => ctx.lineTo(point.x, point.y)); ctx.lineTo(points.at(-1).x, bottom); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
          ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
        }
      });
      for (const marker of markers) {
        ctx.strokeStyle = marker.color || themePaint("#fff"); ctx.fillStyle = marker.color || themePaint("#fff"); ctx.setLineDash([5,4]);
        if (marker.axis === "x") {
          const visibleX = (series[0]?.values || []).slice(state.start, state.end + 1).map((point) => Number(point.x)).filter(Number.isFinite);
          const minX = Math.min(...visibleX), maxX = Math.max(...visibleX), x = left + (number(marker.value) - minX) / Math.max(1e-9, maxX - minX) * (right - left);
          if (Number.isFinite(x) && x >= left && x <= right) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(marker.label, Math.min(right - 90, Math.max(left + 5, x + 5)), top + 12); }
        } else {
          const ratio = (number(marker.value) - sharedMin) / (sharedMax - sharedMin), y = bottom - ratio * (bottom - top);
          if (Number.isFinite(y)) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(marker.label, left + 5, y - 5); }
        }
        ctx.setLineDash([]);
      }
      ctx.fillStyle = themePaint("#8f79a5"); ctx.textAlign = "right";
      for (let i = 0; i <= 5; i++) { const value = sharedMax - (sharedMax - sharedMin) * i / 5; ctx.fillText(yMoney ? compact(value, true) : compact(value), left - 8, top + (bottom - top) * i / 5 + 3); }
      ctx.textAlign = "center"; const base = series[0]?.values || [];
      for (let i = 0; i <= 4; i++) { const index = Math.min(state.end, Math.round(state.start + span * i / 4)); const point = base[index]; if (point) ctx.fillText(xFormatter(point.x, point), left + (right - left) * i / 4, bottom + 19); }
      if (state.hover != null) {
        const x = left + (right - left) * (state.hover - state.start) / span; ctx.strokeStyle = themePaint("rgba(255,255,255,.6)"); ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    function showTooltip(event) {
      const rect = canvas.getBoundingClientRect(), left = 72, right = rect.width - 26, span = Math.max(1, state.end - state.start);
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - left) / Math.max(1, right - left)));
      state.hover = Math.round(state.start + ratio * span); const point = series[0]?.values[state.hover]; if (!point) return;
      tooltip.replaceChildren(element("b", "", xFormatter(point.x, point)));
      for (const item of series) { const value = item.values[state.hover]?.y; if (!Number.isFinite(value)) continue; const row = element("div"); const name = element("span", "", `${item.name}: `); name.style.color = item.color; row.append(name, document.createTextNode(item.money ? compact(value, true) : compact(value))); tooltip.append(row); }
      tooltip.hidden = false; tooltip.style.left = `${Math.min(rect.width - 220, Math.max(0, event.clientX - rect.left))}px`; tooltip.style.top = `${Math.min(rect.height - 100, Math.max(0, event.clientY - rect.top))}px`; draw();
    }

    canvas.addEventListener("pointermove", (event) => {
      if (state.dragX != null) {
        const delta = event.clientX - state.dragX, windowSize = state.end - state.start, shift = Math.round(-delta / canvas.clientWidth * windowSize);
        state.start = Math.max(0, Math.min(maxLength - windowSize - 1, state.dragStart[0] + shift)); state.end = Math.min(maxLength - 1, state.start + windowSize); draw();
      } else showTooltip(event);
    });
    canvas.addEventListener("pointerleave", () => { if (state.dragX == null) { tooltip.hidden = true; state.hover = null; draw(); } });
    canvas.addEventListener("pointerdown", (event) => { state.dragX = event.clientX; state.dragStart = [state.start, state.end]; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointerup", (event) => { state.dragX = null; canvas.releasePointerCapture(event.pointerId); });
    canvas.addEventListener("wheel", (event) => { event.preventDefault(); const old = state.end - state.start + 1; const next = Math.max(10, Math.min(maxLength, Math.round(old * (event.deltaY > 0 ? 1.2 : .8)))); const center = state.hover ?? Math.round((state.start + state.end) / 2); state.start = Math.max(0, Math.min(maxLength - next, center - Math.round(next / 2))); state.end = Math.min(maxLength - 1, state.start + next - 1); draw(); }, { passive: false });
    canvas.addEventListener("dblclick", () => activeChartReset?.());
    range.addEventListener("input", () => { const size = state.end - state.start; const center = Number(range.value); state.start = Math.max(0, Math.min(maxLength - size - 1, center - Math.round(size / 2))); state.end = Math.min(maxLength - 1, state.start + size); draw(); });
    activeChartReset = () => { state.start = 0; state.end = Math.max(0, maxLength - 1); state.hover = null; range.value = String(state.end); tooltip.hidden = true; draw(); };
    draw(); new ResizeObserver(draw).observe(holder);
  }

  function quantLegend(items) {
    const legend = element("div", "quant-legend");
    for (const item of items) {
      const entry = element("span");
      const dot = element("i"); dot.style.background = item.color;
      entry.append(dot, document.createTextNode(item.label));
      if (item.value != null) entry.append(element("b", "", `(${item.value})`));
      legend.append(entry);
    }
    return legend;
  }

  function quantGrid(ctx, left, top, right, bottom, columns = 6, rows = 6) {
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = themePaint("rgba(111,55,153,.22)");
    for (let i = 0; i <= columns; i++) { const x = left + (right - left) * i / columns; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); }
    for (let i = 0; i <= rows; i++) { const y = top + (bottom - top) * i / rows; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
    ctx.restore();
  }

  function quantLine(ctx, points, color, width = 2, fillTo = null) {
    if (!points.length) return;
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = color; ctx.lineWidth = width;
    if (fillTo != null) {
      const gradient = ctx.createLinearGradient(0, Math.min(...points.map((p) => p[1])), 0, fillTo);
      gradient.addColorStop(0, `${color}45`); gradient.addColorStop(1, `${color}03`);
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(points[0][0], fillTo); points.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(points.at(-1)[0], fillTo); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); points.forEach((p, index) => index ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
  }

  function safeBounds(values, includeZero = false, padding = .08) {
    const finite = values.map(Number).filter(Number.isFinite); if (!finite.length) return [-1, 1];
    let min = Math.min(...finite), max = Math.max(...finite); if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
    if (min === max) { const delta = Math.abs(min || 1) * .1; min -= delta; max += delta; }
    const pad = (max - min) * padding; return [min - pad, max + pad];
  }

  function quantCanvas({title,legend=[],items=[],draw,tooltipRows,navigatorValues=[],zoom=true,height=540,plotLeft=78,plotRight=78,timeScale=false,timePadding=false,twoDimensional=false,initialWindow=null,verticalValues=[],onClick=null,zoomAxis='x'}) {
    showVisual();const holder=q("#toolVisual");holder.replaceChildren();q("#chartToolbar").hidden=true;
    const shell=element("div","quant-chart-shell"),head=element("div","quant-chart-head"),heading=element("h2","",title);
    head.append(heading,quantLegend(legend));const plot=element("div","quant-chart-plot"),canvas=element("canvas","tool-chart quant-detail-chart");
    canvas.setAttribute("aria-label",title);canvas.style.height=`${height}px`;
    const tooltip=element("div","chart-tooltip");tooltip.hidden=true;plot.append(canvas,tooltip);shell.append(head,plot);
    const nav=element("div","quant-navigator"),mini=element("canvas"),startRange=document.createElement("input"),endRange=document.createElement("input");
    const state={start:0,end:Math.max(0,items.length-1),hover:null,pointerY:0,dragX:null,dragY:null,dragStart:null,yWindow:[0,1],panning:false};
    if(initialWindow){state.start=initialWindow.start??state.start;state.end=initialWindow.end??state.end;state.yWindow=initialWindow.yWindow??state.yWindow;}
    const remembered=chartWindows.get(activeTool?.id);
    if(remembered&&remembered.length<=items.length){const tail=remembered.end>=remembered.length-1,extra=tail?items.length-remembered.length:0;state.start=Math.min(items.length-1,remembered.start+extra);state.end=Math.min(items.length-1,remembered.end+extra);state.yWindow=[...remembered.yWindow];}
    for(const [input,label] of [[startRange,"Chart window start"],[endRange,"Chart window end"]]){input.type="range";input.min="0";input.max=String(Math.max(0,items.length-1));input.step="1";input.setAttribute("aria-label",label);}
    startRange.className="navigator-start";endRange.className="navigator-end";
    if(zoom&&items.length>1){nav.append(mini,startRange,endRange);shell.append(nav);if(zoomAxis==='y'){nav.classList.add('category-vertical-navigator');shell.classList.add('category-vertical-chart');}}
    const vertical=element("div","quant-vertical-navigator"),verticalMini=element("canvas"),lowRange=document.createElement("input"),highRange=document.createElement("input");
    if(twoDimensional){shell.classList.add("two-dimensional-chart");for(const [input,label] of [[lowRange,"Chart vertical window start"],[highRange,"Chart vertical window end"]]){input.type="range";input.min="0";input.max="1000";input.step="1";input.setAttribute("aria-label",label);}vertical.append(verticalMini,lowRange,highRange);plot.append(vertical);}
    holder.append(shell);let disposed=false,horizontalNavigation,verticalNavigation,windowSaveTimer,resetAnimation;
    const syncRanges=()=>{startRange.value=String(state.start);endRange.value=String(state.end);lowRange.value=String(Math.round(state.yWindow[0]*1000));highRange.value=String(Math.round(state.yWindow[1]*1000));horizontalNavigation?.sync();verticalNavigation?.sync();};
    function remember(){if(activeTool)chartWindows.set(activeTool.id,{start:state.start,end:state.end,yWindow:[...state.yWindow],length:items.length});clearTimeout(windowSaveTimer);windowSaveTimer=setTimeout(()=>{try{gexStorage.setItem(`gex-data-chart-windows:${instanceKey}`,JSON.stringify([...chartWindows]));}catch{}},300);syncRanges();}
    function drawNavigator(){
      if(!mini.isConnected)return;
      const {ctx,width:w,height:h}=canvasContext(mini);ctx.clearRect(0,0,w,h);
      const values=navigatorValues.length?navigatorValues:items.map((_,index)=>index),previewDomain=navigatorPreviewDomain(values);
      if(!previewDomain)return;const domain=timeScale?timeDomain(items):null,navX=index=>domain?timeX(timeAtIndex(items,index),domain,0,w):index/Math.max(1,values.length-1)*w,{min,max}=previewDomain,pts=values.map((value,index)=>[navX(index),h-(value-min)/Math.max(1e-9,max-min)*h]);
      if(zoomAxis==='y'){ctx.beginPath();values.forEach((value,index)=>{const x=(value-min)/Math.max(1e-9,max-min)*w,y=h-index/Math.max(1,values.length-1)*h;index?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=1;ctx.stroke();const top=(1-state.end/Math.max(1,items.length-1))*h,bottom=(1-state.start/Math.max(1,items.length-1))*h;ctx.fillStyle=themePaint("rgba(106,18,237,.2)");ctx.fillRect(0,top,w,bottom-top);ctx.strokeStyle=themePaint("#E2D7F1");ctx.strokeRect(.5,top,w-1,bottom-top);return;}
      quantLine(ctx,pts,CHART_COLORS.primary,1,h);
      const startX=navX(state.start),endX=navX(state.end);
      ctx.fillStyle=themePaint("rgba(112,15,236,.15)");ctx.fillRect(startX,0,endX-startX,h);ctx.strokeStyle=themePaint("#E2D7F1");ctx.lineWidth=1;ctx.strokeRect(startX+.5,.5,Math.max(1,endX-startX-1),h-1);
      ctx.fillStyle=themePaint("#FFFFFF");ctx.fillRect(Math.max(0,startX-2),0,4,h);ctx.fillRect(Math.min(w-4,endX-2),0,4,h);
    }
    function drawVertical(){if(!verticalMini.isConnected)return;const {ctx,width:w,height:h}=canvasContext(verticalMini);ctx.clearRect(0,0,w,h);const valueOf=item=>typeof item==="number"?item:item.value,maximum=Math.max(1,...verticalValues.map(item=>Math.abs(valueOf(item))));ctx.beginPath();verticalValues.forEach((item,index)=>{const x=Math.abs(valueOf(item))/maximum*w,y=h-(typeof item==="number"?index/Math.max(1,verticalValues.length-1):item.position)*h;index?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=1;ctx.stroke();const top=(1-state.yWindow[1])*h,bottom=(1-state.yWindow[0])*h;ctx.fillStyle=themePaint("rgba(112,15,236,.15)");ctx.fillRect(0,top,w,bottom-top);ctx.strokeStyle=themePaint("#E2D7F1");ctx.strokeRect(.5,top,w-1,bottom-top);ctx.fillStyle=themePaint("#fff");ctx.fillRect(0,top,w,4);ctx.fillRect(0,bottom-4,w,4);}
    function redraw(){if(disposed||!canvas.isConnected)return;const {ctx,width:w,height:h}=canvasContext(canvas);if(w<=0||h<=0)return;ctx.clearRect(0,0,w,h);ctx.font="700 13px Aleph, sans-serif";ctx.fillStyle=themePaint("#fff");draw(ctx,w,h,{...state,start:Math.floor(state.start),end:Math.min(items.length-1,Math.ceil(state.end)),rawStart:state.start,rawEnd:state.end});drawNavigator();drawVertical();}
    function hoverIndex(event){
      if(!items.length)return null;
      const rect=canvas.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left-plotLeft)/Math.max(1,rect.width-plotRight-plotLeft)));
      if(timeScale){const domain=timeDomain(items,state.start,state.end,{padBars:timePadding});if(domain){const index=nearestTimeIndex(items,domain.min+ratio*(domain.max-domain.min),Math.floor(state.start),Math.ceil(state.end));state.hoverRatio=(items[index].time-domain.min)/(domain.max-domain.min);return index;}}
      state.hoverRatio=null;return Math.min(items.length-1,Math.ceil(state.end),Math.round(state.start+ratio*Math.max(1,state.end-state.start)));
    }
    canvas.addEventListener("pointermove",event=>{
      const rect=canvas.getBoundingClientRect();state.pointerY=event.clientY-rect.top;state.pointerX=event.clientX-rect.left;
      if(state.dragX!=null){
        if(!zoom)return;
        if(!state.panning){if(Math.abs(event.clientX-state.dragX)+Math.abs(event.clientY-state.dragY)<=3)return;state.panning=true;state.dragX=event.clientX;state.dragY=event.clientY;canvas.style.cursor='grabbing';return;}
        const shift=zoomAxis==='y'?-(event.clientY-state.dragY)/Math.max(1,rect.height-44):(event.clientX-state.dragX)/Math.max(1,rect.width-plotLeft-plotRight),window=panZoomWindow({start:state.dragStart[0],end:state.dragStart[1]},shift,items.length-1);state.start=window.start;state.end=window.end;
        if(twoDimensional){const span=state.dragStart[3]-state.dragStart[2],dy=(event.clientY-state.dragY)/Math.max(1,rect.height-44)*span,lo=Math.max(0,Math.min(1-span,state.dragStart[2]+dy));state.yWindow=[lo,lo+span];}
        remember();redraw();return;
      }
      state.hover=hoverIndex(event);
      if(tooltipRows&&state.hover!=null){const hoverState={...state,start:Math.floor(state.start),end:Math.min(items.length-1,Math.ceil(state.end))},rows=tooltipRows(items[state.hover],state.hover,hoverState)||[];state.hover=hoverState.hover;tooltip.replaceChildren(...rows.map((row,index)=>index?element("div","",row):element("b","",row)));tooltip.hidden=toolConfiguration.hideTooltips||!rows.length;const size=tooltip.getBoundingClientRect(),position=cursorTooltipPlacement(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height,size.width,size.height);tooltip.style.left=`${position.left}px`;tooltip.style.top=`${position.top}px`;}
      redraw();
    });
    canvas.addEventListener("pointerleave",()=>{state.dragX=null;state.panning=false;state.hover=null;tooltip.hidden=true;canvas.style.cursor='crosshair';redraw();});
    canvas.addEventListener("pointerdown",event=>{if(!zoom&&!onClick)return;cancelAnimationFrame(resetAnimation);state.dragX=event.clientX;state.dragY=event.clientY;state.dragStart=[state.start,state.end,...state.yWindow];state.panning=false;tooltip.hidden=true;canvas.setPointerCapture(event.pointerId);});
    const stopDrag=event=>{if(event.type!=='pointercancel'&&onClick&&!state.panning&&state.dragX!=null&&Math.abs(event.clientX-state.dragX)+Math.abs(event.clientY-state.dragY)<=5)onClick(items[state.hover],state.hover,state);state.dragX=null;state.panning=false;canvas.style.cursor="crosshair";if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);};
    canvas.addEventListener("pointerup",stopDrag);canvas.addEventListener("pointercancel",stopDrag);
    canvas.addEventListener("wheel",event=>{
      if(!zoom||(!twoDimensional&&items.length<2))return;
      cancelAnimationFrame(resetAnimation);
      const rect=canvas.getBoundingClientRect(),verticalFraction=Math.max(0,Math.min(1,1-(event.clientY-rect.top-10)/Math.max(1,rect.height-44))),anchor=zoomAxis==='y'?verticalFraction:Math.max(0,Math.min(1,(event.clientX-rect.left-plotLeft)/Math.max(1,rect.width-plotLeft-plotRight)));
      if(activeTool?.id==='heat-map'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();const maxIndex=Math.max(1,verticalValues.length-1),next=heatMapPlainWheel({start:state.yWindow[0]*maxIndex,end:state.yWindow[1]*maxIndex},event.deltaY,maxIndex);state.yWindow=[next.start/maxIndex,next.end/maxIndex];remember();redraw();return;}
      const result=wheelZoomWindow({start:state.start,end:state.end},items.length-1,normalizeWheelDelta(event),anchor);
      const verticalResult=twoDimensional?wheelZoomWindow({start:state.yWindow[0]*1000,end:state.yWindow[1]*1000},1000,normalizeWheelDelta(event),verticalFraction):null;
      if(!result.handled&&!verticalResult?.handled)return;event.preventDefault();state.start=result.window.start;state.end=result.window.end;
      if(verticalResult)state.yWindow=[verticalResult.window.start/1000,verticalResult.window.end/1000];
      tooltip.hidden=true;remember();redraw();
    },{passive:false});
    startRange.addEventListener("input",()=>{state.start=Math.min(Number(startRange.value),Math.max(0,state.end-2));remember();redraw();});
    endRange.addEventListener("input",()=>{state.end=Math.max(Number(endRange.value),Math.min(items.length-1,state.start+2));remember();redraw();});
    lowRange.addEventListener("input",()=>{state.yWindow[0]=Math.min(Number(lowRange.value)/1000,state.yWindow[1]-.002);remember();redraw();});
    highRange.addEventListener("input",()=>{state.yWindow[1]=Math.max(Number(highRange.value)/1000,state.yWindow[0]+.002);remember();redraw();});
    activeChartReset=()=>{cancelAnimationFrame(resetAnimation);const max=Math.max(1,items.length-1),target={start:(initialWindow?.start??0)/max*100,end:(initialWindow?.end??max)/max*100},targetY=initialWindow?.yWindow?[...initialWindow.yWindow]:[0,1];state.hover=null;tooltip.hidden=true;const tick=()=>{if(disposed)return;const x=lerpZoomStep({start:state.start/max*100,end:state.end/max*100},target),y=lerpZoomStep({start:state.yWindow[0]*100,end:state.yWindow[1]*100},{start:targetY[0]*100,end:targetY[1]*100});state.start=x.next.start/100*max;state.end=x.next.end/100*max;state.yWindow=[y.next.start/100,y.next.end/100];remember();redraw();if(!x.converged||!y.converged)resetAnimation=requestAnimationFrame(tick);};tick();};
    if(zoom&&items.length>1){startRange.hidden=endRange.hidden=true;horizontalNavigation=bindZoomNavigator({host:nav,length:items.length,getWindow:()=>({start:state.start,end:state.end}),setWindow:window=>{state.start=window.start;state.end=window.end;remember();redraw();},vertical:zoomAxis==='y',minSpan:['interval-map','heat-map'].includes(activeTool?.id)?0:undefined});}
    if(twoDimensional){lowRange.hidden=highRange.hidden=true;const count=Math.max(2,verticalValues.length);verticalNavigation=bindZoomNavigator({host:vertical,length:count,vertical:true,minSpan:0,getWindow:()=>({start:state.yWindow[0]*(count-1),end:state.yWindow[1]*(count-1)}),setWindow:window=>{state.yWindow=[window.start/(count-1),window.end/(count-1)];remember();redraw();},label:'Chart vertical window'});}
    const observer=new ResizeObserver(redraw);observer.observe(shell);activeChartDispose=()=>{disposed=true;clearTimeout(windowSaveTimer);cancelAnimationFrame(resetAnimation);observer.disconnect();};syncRanges();redraw();return{shell,canvas,redraw,state,
      update(nextItems,nextLegend,nextNavigatorValues){
        if(disposed||!compatibleLiveTimeline(items,nextItems))return false;
        const nextWindow=liveChartWindow(state,items.length,nextItems.length),shift=nextWindow.start-state.start;
        cancelAnimationFrame(resetAnimation);
        items.splice(0,items.length);for(const row of nextItems)items.push(row);
        navigatorValues=nextNavigatorValues;
        state.start=nextWindow.start;state.end=nextWindow.end;
        if(state.dragStart){state.dragStart[0]+=shift;state.dragStart[1]+=shift;}
        startRange.max=endRange.max=String(Math.max(0,items.length-1));horizontalNavigation?.setLength(items.length);
        head.replaceChild(quantLegend(nextLegend),head.lastChild);remember();redraw();return true;
      }};
  }

  function drawAxisLabels(ctx,{left,top,right,bottom,min,max,money=false,rightSide=false,steps=5,label="",formatter=null}){
    ctx.save();ctx.fillStyle=themePaint("#FFFFFF");ctx.font="700 13px Aleph, sans-serif";ctx.textAlign=rightSide?"left":"right";
    for(const value of niceTicks(min,max,steps)){const y=bottom-(value-min)/Math.max(1e-9,max-min)*(bottom-top);ctx.fillText(formatter?formatter(value):money?compact(value,true):compact(value),rightSide?right+7:left-8,y+4);}
    if(label&&!toolConfiguration.hideAxisTitles){ctx.translate(rightSide?right+66:18,(top+bottom)/2);ctx.rotate(rightSide?Math.PI/2:-Math.PI/2);ctx.textAlign="center";ctx.fillText(label,0,0);}ctx.restore();
  }

  function drawHorizontalTicks(ctx,left,right,top,bottom,min,max,formatter) {
    ctx.save();ctx.font="700 13px Aleph, sans-serif";ctx.textAlign="right";ctx.fillStyle=themePaint("#fff");
    for(const value of niceTicks(min,max,5)){const y=bottom-(value-min)/Math.max(1e-9,max-min)*(bottom-top);ctx.strokeStyle=CHART_COLORS.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
    ctx.restore();
  }

  function drawChartCrosshair(ctx,state,left,right,top,bottom) {
    if(state.hover==null||toolConfiguration.hideCrosshairs)return;const x=left+(right-left)*(state.hoverRatio??((state.hover-state.start)/Math.max(1,state.end-state.start))),y=Math.max(top,Math.min(bottom,state.pointerY));ctx.save();ctx.strokeStyle=themePaint("rgba(255,255,255,.45)");ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.restore();
  }

  function drawTimeLabels(ctx,rows,start,end,left,right,bottom,domain=timeDomain(rows,start,end)){
    if(!domain)return;ctx.save();ctx.fillStyle=themePaint("#FFFFFF");ctx.font="700 13px Aleph, sans-serif";ctx.textAlign="center";ctx.textBaseline="top";let previous=-Infinity;
    for(const time of timeTicks(domain.min,domain.max,right-left,13)){const x=timeX(time,domain,left,right),label=displayChartTime(time),width=ctx.measureText(label).width;if(x-width/2<previous+8)continue;ctx.fillText(label,x,bottom+6);previous=x+width/2;}
    ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();ctx.restore();
  }

  function renderIntervalMapQuant(payload) {
    const rawRows=parseInterval(payload,parsePrices({data:payload.stock||{}}));
    const ticker=String(getControl("ticker")||"QQQ").toUpperCase(),greek=getControl("greek")||"GAMMA";
    const code={GAMMA:"GEX",DELTA:"DEX",CHARM:"CHEX",VANNA:"VEX"}[greek];
    const difference=getControl("intervalValueMode")==="DIFFERENCE";
    const rows=difference?rawRows.map((row,index)=>{
      const previous=new Map((rawRows[index-1]?.strikes||[]).map(point=>[point.strike,point.value]));
      return {...row,strikes:row.strikes.map(point=>({...point,value:index?point.value-(previous.get(point.strike)||0):0}))};
    }).slice(1):rawRows;
    const padding=Math.max(0,Math.round(Number(getControl("strikePadding"))||0));
    const minStrike=getControl("minStrike")===""?undefined:Number(getControl("minStrike")),maxStrike=getControl("maxStrike")===""?undefined:Number(getControl("maxStrike"));
    const autoBounds=intervalStrikeWindow(rows,padding),baseMin=minStrike??autoBounds[0],baseMax=maxStrike??autoBounds[1],profile=(rows.at(-1)?.strikes||[]).filter(point=>point.strike>=baseMin&&point.strike<=baseMax).map(point=>({position:(point.strike-baseMin)/Math.max(1e-9,baseMax-baseMin),value:Math.abs(point.value)}));
    let plotBounds=null;
    const chart=quantCanvas({
      title:`Interval Map (${code}) - ${ticker}`,
      legend:[{label:ticker,color:CHART_COLORS.primary,value:formatPrice(rows.at(-1)?.spot)}],
      items:rows,navigatorValues:intervalPreview(rows),verticalValues:profile,height:560,plotLeft:98,plotRight:48,twoDimensional:true,timeScale:true,
      tooltipRows:(row,index,state)=>{
        if(!row||!plotBounds)return [];
        const strike=plotBounds.maxY-(state.pointerY-plotBounds.top)/Math.max(1,plotBounds.bottom-plotBounds.top)*(plotBounds.maxY-plotBounds.minY);
        const point=row.strikes.reduce((best,point)=>!best||Math.abs(point.strike-strike)<Math.abs(best.strike-strike)?point:best,null);
        if(!point)return [];
        return [displayChartTime(row.time),`${ticker} · ${formatPrice(point.strike)}`,...(difference?[]:[`Call ${code}: ${compact(point.call)}`,`Put ${code}: ${compact(point.put)}`]),`${difference?"Difference of net":"Net"} ${code}: ${compact(point.value)}`,`${ticker}: ${formatPrice(row.spot)}`];
      },
      draw:(ctx,w,h,state)=>{
        plotBounds=drawIntervalPlot(ctx,w,h,rows,{start:state.rawStart??state.start,end:state.rawEnd??state.end,padding,minStrike,maxStrike,right:w-48,yWindow:state.yWindow,hover:toolConfiguration.hideCrosshairs?null:state.hover,hideAxisTitles:toolConfiguration.hideAxisTitles,formatTime:displayChartTime,formatStrike:chartStrikeLabel});
      }
    });
    chart.shell.classList.add("interval-chart-shell");
    const latest=rawRows.at(-1)?.strikes||[],latestNet=latest.reduce((sum,point)=>sum+point.value,0);
    setSummary([["Session snapshots",rows.length.toLocaleString()],["Strikes",new Set(rows.flatMap(row=>row.strikes.map(point=>point.strike))).size],["Latest spot",formatPrice(rows.at(-1)?.spot)],["Latest net exposure",compact(latestNet)]]);
  }

  function renderExposureProfileQuant(payload,byExpiration=false) {
    const ticker=String(getControl("ticker")||"QQQ").toUpperCase(),greek=getControl("greek")||"GAMMA",code={GAMMA:"GEX",DELTA:"DEX",CHARM:"CHEX",VANNA:"VEX"}[greek],display=getControl("exposureDisplay")||"NET",orientation=getControl("exposureOrientation")||"HORIZONTAL";
    const model=aggregateExposureTool(payload),root=payload.data?.[ticker]||payload.data||{},spot=Number(root.stockPrice);
    const points=byExpiration?Object.entries(root.exposureMap||{}).map(([label,strikes])=>({label,call:Object.values(strikes||{}).reduce((sum,leg)=>sum+number(leg.callExposure),0),put:Object.values(strikes||{}).reduce((sum,leg)=>sum+number(leg.putExposure),0)})).sort((a,b)=>a.label.localeCompare(b.label)):model.points.map(point=>({...point,label:point.strike}));
    const total=points.reduce((sum,point)=>sum+point.call+point.put,0),range=byExpiration?[0,points.length-1]:exposureStrikeWindow(points.map(point=>point.strike),spot),units=q('[data-control="representation"]')?.selectedOptions[0]?.text||"";
    const legend=display==="NET"?[{label:"Net "+code,color:total>=0?CHART_COLORS.call:CHART_COLORS.put,value:compact(total)}]:[{label:"Call Exposure",color:CHART_COLORS.call},{label:"Put Exposure",color:CHART_COLORS.put}].filter(item=>display==="SPLIT"||item.label===(display==="CALL"?"Call Exposure":"Put Exposure"));if(!byExpiration)legend.push({label:ticker,color:CHART_COLORS.primary,value:formatPrice(spot)});
    let bounds;
    quantCanvas({title:`${display==="NET"?"Net ":""}${greek[0]+greek.slice(1).toLowerCase()} Exposure By ${byExpiration?"Expiration":"Strike"} - ${ticker}`,legend,items:points,navigatorValues:points.map(point=>byExpiration&&display==='NET'?point.call+point.put:Math.abs(point.call)+Math.abs(point.put)),height:540,zoomAxis:orientation==='VERTICAL'?'y':'x',initialWindow:{start:range[0],end:range[1]},
      tooltipRows:(point,index,state)=>{if(orientation==="VERTICAL"&&bounds){let nearest=state.start;for(let i=state.start;i<=state.end;i++)if(Math.abs(bounds.categoryPixel(points[i],i)-state.pointerY)<Math.abs(bounds.categoryPixel(points[nearest],nearest)-state.pointerY))nearest=i;point=points[nearest];state.hover=nearest;}return point?[byExpiration?point.label:chartStrikeLabel(point.strike),`Calls ${compact(point.call)}`,`Puts ${compact(point.put)}`,`Net ${code} ${compact(point.call+point.put)}`]:[];},
      draw:(ctx,w,h,state)=>{bounds=drawExposureBars(ctx,w,h,points,{orientation,display,byExpiration,spot,start:state.start,end:state.end,axisName:`${greek[0]+greek.slice(1).toLowerCase()} Exposure (${units})`,categoryFormatter:point=>byExpiration?new Date(point.label+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'}):chartStrikeLabel(point.strike),valueFormatter:abbreviatedTick,hover:toolConfiguration.hideCrosshairs?null:state.hover,hideAxisTitles:toolConfiguration.hideAxisTitles,pointerX:state.pointerX,pointerY:state.pointerY});}
    });
    setSummary([["Exposure",compact(total),total>=0?"positive":"negative"],[byExpiration?"Expirations":"Strikes",points.length],["Underlying",formatPrice(spot)],["Units",units]]);
  }


  function renderNetDriftQuant(payload) {
    const rows=parseNetDrift(payload),ticker=String(getControl("ticker")||"QQQ").toUpperCase(),last=rows.at(-1)||{},showNet=getControl("driftNet")==="SHOW",showBands=getControl("driftBands")==="SHOW",showUnderlying=getControl("driftUnderlying")!=="HIDE"&&rows.some(row=>Number.isFinite(row.spot));
    const presentationKey=JSON.stringify([buildRequest(activeTool),ticker,showNet,showBands,showUnderlying,gexTimeZone()]);
    const legendFor=row=>[{label:"Calls",color:CHART_COLORS.call,value:compact(row.call,true)},{label:"Puts",color:CHART_COLORS.put,value:compact(row.put,true)},...(showNet?[{label:"Net Premium",color:CHART_COLORS.netPremium,value:compact(row.net,true)}]:[]),...(showUnderlying?[{label:ticker,color:CHART_COLORS.price,value:formatPrice(row.spot)}]:[])];
    const summarize=row=>setSummary([["Net calls",compact(row.call,true),"positive"],["Net puts",compact(row.put,true),"negative"],["Underlying",formatPrice(row.spot)],["Intervals",rows.length]]);
    const chart=quantCanvas({
      title:`Net Drift (Premium) - ${ticker}`,
      legend:legendFor(last),
      items:rows,navigatorValues:rows.map(row=>row.call),height:540,timeScale:true,
      onClick:(row,index)=>{if(!row)return;const period=getControl('period')||'1m',duration=Number.parseInt(period,10)*(period.endsWith('h')?3600000:60000),end=rows[index+1]?.time??row.time+duration;openTradeDetail({individual:true,title:'Net Drift · Individual Prints',preview:`${ticker} · ${displayChartTime(row.time)} · actual prints in this interval`,timeRange:{startTime:new Date(row.time).toISOString(),endTime:new Date(end).toISOString()}});},
      tooltipRows:row=>row?[displayChartTime(row.time),`Calls ${compact(row.call,true)}`,`Puts ${compact(row.put,true)}`,`Volume ${compact(row.callVolume-row.putVolume)}`,`${ticker} ${formatPrice(row.spot)}`]:[],
      draw:(ctx,w,h,state)=>{
        const left=78,right=w-78,top=10,bottom=h-32,paneHeight=Math.min(100,h*.15),gap=Math.min(20,h*.1),volumeTop=bottom-paneHeight,mainBottom=volumeTop-gap;
        const visible=rows.slice(state.start,state.end+1),span=Math.max(1,visible.length-1);
        const [rawMin,rawMax]=safeBounds(visible.flatMap(row=>[row.call,row.put,...(showNet?[row.net]:[]),...(showBands?[row.call-Math.abs(row.callBand),row.call+Math.abs(row.callBand),row.put-Math.abs(row.putBand),row.put+Math.abs(row.putBand)]:[])]),false,0),{min:pmin,max:pmax}=niceValueDomain(rawMin,rawMax),[spotMin,spotMax]=safeBounds(visible.map(row=>row.spot),false,0),{min:smin,max:smax}=niceValueDomain(spotMin,spotMax);
        const volumes=visible.map(row=>row.callVolume-row.putVolume),[volumeMin,volumeMax]=safeBounds(volumes,true,.02),{min:vmin,max:vmax}=niceValueDomain(volumeMin,volumeMax);
        const domain=timeDomain(rows,state.rawStart??state.start,state.rawEnd??state.end),x=index=>timeX(visible[index]?.time,domain,left,right),py=value=>mainBottom-(value-pmin)/(pmax-pmin)*(mainBottom-top),sy=value=>mainBottom-(value-smin)/(smax-smin)*(mainBottom-top),vy=value=>bottom-(value-vmin)/(vmax-vmin)*(bottom-volumeTop);
        drawHorizontalTicks(ctx,left,right,top,mainBottom,pmin,pmax,value=>compact(value,true));
        if(showBands){for(const [valueKey,bandKey,color] of [["call","callBand",CHART_COLORS.call],["put","putBand",CHART_COLORS.put]]){ctx.save();ctx.beginPath();visible.forEach((row,index)=>index?ctx.lineTo(x(index),py(row[valueKey]+Math.abs(row[bandKey]))):ctx.moveTo(x(index),py(row[valueKey]+Math.abs(row[bandKey]))));for(let index=visible.length-1;index>=0;index--)ctx.lineTo(x(index),py(visible[index][valueKey]-Math.abs(visible[index][bandKey])));ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=.2;ctx.fill();ctx.restore();}}
        quantLine(ctx,visible.map((row,index)=>[x(index),py(row.call)]),CHART_COLORS.call,2);
        quantLine(ctx,visible.map((row,index)=>[x(index),py(row.put)]),CHART_COLORS.put,2);
        if(showNet)quantLine(ctx,visible.map((row,index)=>[x(index),py(row.net)]),CHART_COLORS.netPremium,2);
        if(showUnderlying)quantLine(ctx,visible.map((row,index)=>[x(index),sy(row.spot)]).filter(point=>Number.isFinite(point[1])),CHART_COLORS.price,2);
        drawSignedVolume(ctx,volumes.map((value,index)=>[x(index),vy(value)]),vy(0),volumeTop,bottom);
        drawAxisLabels(ctx,{left,top,right,bottom:mainBottom,min:pmin,max:pmax,money:true,label:"Premium ($)"});
        if(showUnderlying)drawAxisLabels(ctx,{left,top,right,bottom:mainBottom,min:smin,max:smax,formatter:chartStrikeLabel,rightSide:true,label:"Underlying ($)"});
        drawAxisLabels(ctx,{left,top:volumeTop,right,bottom,min:vmin,max:vmax,label:"Volume",steps:5});
        drawTimeLabels(ctx,rows,state.rawStart??state.start,state.rawEnd??state.end,left,right,bottom);
        drawChartCrosshair(ctx,state,left,right,top,bottom);
      }
    });
    activeChartUpdate=nextPayload=>{
      const nextRows=parseNetDrift(nextPayload),nextLast=nextRows.at(-1)||{};
      if(JSON.stringify([buildRequest(activeTool),String(getControl('ticker')||'QQQ').toUpperCase(),getControl('driftNet')==='SHOW',getControl('driftBands')==='SHOW',getControl('driftUnderlying')!=='HIDE'&&nextRows.some(row=>Number.isFinite(row.spot)),gexTimeZone()])!==presentationKey)return false;
      if(!chart.update(nextRows,legendFor(nextLast),nextRows.map(row=>row.call)))return false;
      summarize(nextLast);return true;
    };
    summarize(last);
  }

  function renderDarkFlowQuant(payload) {
    const rows=numericEntries(payload.data||{}).map(([time,row])=>({time:Number(time),notional:number(row.notionalValue),spot:Number(row.stockPrice),tradeCount:number(row.tradeCount),size:number(row.size)}));
    const ticker=String(getControl("ticker")||"QQQ").toUpperCase();
    quantCanvas({
      title:`Dark Flow - ${ticker}`,
      legend:[{label:"Notional Value",get color(){return themePaint("#C687FF");},value:compact(rows.reduce((sum,row)=>sum+row.notional,0),true)},{label:ticker,color:CHART_COLORS.primary,value:formatPrice(rows.at(-1)?.spot)}],
      items:rows,navigatorValues:rows.map(row=>row.notional),height:540,timeScale:true,plotLeft:88,
      tooltipRows:row=>row?[displayChartTime(row.time),`Notional ${compact(row.notional,true)}`,`Trades ${compact(row.tradeCount)}`,`Shares ${compact(row.size)}`,`${ticker} ${formatPrice(row.spot)}`]:[],
      draw:(ctx,w,h,state)=>{
        const left=88,right=w-78,top=12,bottom=h-34,visible=rows.slice(state.start,state.end+1),span=Math.max(1,visible.length-1);
        const {min:nmin,max:nmax}=niceValueDomain(0,Math.max(0,...visible.map(row=>row.notional))),prices=visible.map(row=>row.spot).filter(Number.isFinite),{min:smin,max:smax}=niceValueDomain(Math.min(...prices),Math.max(...prices));
        const domain=timeDomain(rows,state.rawStart??state.start,state.rawEnd??state.end),x=index=>timeX(visible[index]?.time,domain,left,right),ny=value=>bottom-(value-nmin)/(nmax-nmin)*(bottom-top),sy=value=>bottom-(value-smin)/(smax-smin)*(bottom-top);
        drawHorizontalTicks(ctx,left,right,top,bottom,nmin,nmax,value=>compact(value,true));
        const points=visible.map((row,index)=>[x(index),ny(row.notional)]);
        drawDarkFlowArea(ctx,points,{top,bottom});
        quantLine(ctx,visible.map((row,index)=>[x(index),sy(row.spot)]).filter(point=>Number.isFinite(point[1])),CHART_COLORS.price,2);
        drawAxisLabels(ctx,{left,top,right,bottom,min:nmin,max:nmax,money:true,formatter:value=>currencyAbbreviated(value),label:"Notional Value"});
        drawAxisLabels(ctx,{left,top,right,bottom,min:smin,max:smax,formatter:chartStrikeLabel,rightSide:true,label:"Underlying ($)"});
        drawTimeLabels(ctx,rows,state.rawStart??state.start,state.rawEnd??state.end,left,right,bottom);drawChartCrosshair(ctx,state,left,right,top,bottom);
      }
    });
    setSummary([["Notional",compact(rows.reduce((sum,row)=>sum+row.notional,0),true)],["Trades",compact(rows.reduce((sum,row)=>sum+row.tradeCount,0))],["Shares",compact(rows.reduce((sum,row)=>sum+row.size,0))],["Last price",formatPrice(rows.at(-1)?.spot)]]);
  }

  function renderDarkLevelsQuant(payload) {
    const metric=getControl("levelMetric")||"price",limit=Math.max(1,Math.min(1000,Number(getControl("topLevels"))||50));
    const all=Object.entries(payload.data||{}).map(([price,row])=>({price:Number(price),notionalValue:number(row.notionalValue),tradeCount:number(row.tradeCount),volume:number(row.size)})).filter(row=>Number.isFinite(row.price)).sort((a,b)=>b.notionalValue-a.notionalValue);
    const rows=all.slice(0,limit).map((row,index)=>({rank:index+1,...row}));const sortKey=metric==="size"?"volume":metric;
    rows.sort((a,b)=>b[sortKey]-a[sortKey]);showTable(prepareDarkPoolLevels(payload,{limit,sortKey}),DARK_POOL_LEVEL_COLUMNS.map(column=>({...column,type:column.key==="price"||column.key==="notionalValue"?"money":column.key==="rank"?"integer":"abbreviated",...(column.key==="notionalValue"?{bar:"primary",fractionField:"notionalFraction"}:column.key==="tradeCount"?{percentField:"tradeFraction"}:column.key==="volume"?{percentField:"volumeFraction"}:{})})),null,{sortKey});
    setSummary([["Top levels",rows.length],["Available levels",all.length.toLocaleString()],["Leading price",formatPrice(all[0]?.price)],["Underlying",formatPrice(payload.latestStockPrice)]]);
  }

  function renderOhlcQuant(payload,tool) {
    const rows=parsePriceRows(payload,{data:payload.stock||{}});
    const ticker=String(getControl("ticker")||"QQQ").toUpperCase(),chartType=getControl("chartType")||"candles";
    const option=tool.view==="optionOhlc",osi=getControl("osi"),contractType=/[CP]\d{8}$/.test(osi)?osi.match(/([CP])\d{8}$/)[1]==="C"?"CALL":"PUT":getControl("contractType"),presentation=priceChartPresentation({option,contractType,chartType,rows}),hasVolume=presentation.showVolume,hasUnderlying=presentation.showUnderlying;
    const legend=[{label:option?(osi||`${ticker} ${getControl("expiry")} ${getControl("strike")} ${contractType}`):ticker,color:option?presentation.lineColor:CHART_COLORS.primary,value:formatPrice(rows.at(-1)?.close)}];
    if(hasUnderlying)legend.push({label:ticker,color:CHART_COLORS.primary,value:formatPrice(rows.at(-1)?.spot)});
    quantCanvas({
      title:`${tool.title} - ${ticker}`,legend,items:rows,navigatorValues:rows.map(row=>row.close),height:540,timeScale:true,timePadding:chartType==="candles"||hasVolume,plotRight:hasUnderlying?78:30,
      tooltipRows:row=>row?[displayChartTime(row.time),`O ${formatPrice(row.open)} · H ${formatPrice(row.high)}`,`L ${formatPrice(row.low)} · C ${formatPrice(row.close)}`,...(hasVolume?[`Option Volume ${compact(row.volume)}`]:[]),...(hasUnderlying?[`${ticker} ${formatPrice(row.spot)}`]:[])]:[],
      draw:(ctx,w,h,state)=>{
        const left=78,right=w-(hasUnderlying?78:30),top=12,bottom=h-34,visible=rows.slice(state.start,state.end+1),span=Math.max(1,visible.length-1);
        const paneHeight=hasVolume?Math.min(100,h*.15):0,volumeTop=bottom-paneHeight,mainBottom=hasVolume?volumeTop-Math.min(20,h*.1):bottom;
        const lows=visible.map(row=>row.low).filter(Number.isFinite),highs=visible.map(row=>row.high).filter(Number.isFinite),{min:pmin,max:pmax}=niceValueDomain(Math.min(...lows),Math.max(...highs)),vmax=niceValueDomain(0,Math.max(1,...visible.map(row=>row.volume||0))).max;
        const domain=timeDomain(rows,state.rawStart??state.start,state.rawEnd??state.end,{padBars:chartType==="candles"||hasVolume}),x=index=>timeX(visible[index]?.time,domain,left,right),py=value=>mainBottom-(value-pmin)/(pmax-pmin)*(mainBottom-top),slot=visible.length>1?(right-left)*(visible.at(-1).time-visible[0].time)/Math.max(1,domain.max-domain.min)/(visible.length-1):(right-left);
        drawHorizontalTicks(ctx,left,right,top,mainBottom,pmin,pmax,chartStrikeLabel);
        ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,mainBottom-top);ctx.clip();
        if(chartType==="candles")drawPriceCandles(ctx,visible,x,py,slot);
        else if(presentation.lineColor)quantLine(ctx,visible.filter(row=>Number.isFinite(row.close)).map(row=>[x(visible.indexOf(row)),py(row.close)]),presentation.lineColor,2);
        const spotValues=visible.map(row=>row.spot).filter(Number.isFinite),{min:smin,max:smax}=spotValues.length?niceValueDomain(Math.min(...spotValues),Math.max(...spotValues)):{min:0,max:1},sy=value=>mainBottom-(value-smin)/(smax-smin)*(mainBottom-top);
        if(hasUnderlying)quantLine(ctx,visible.map((row,index)=>[x(index),Number.isFinite(row.spot)?sy(row.spot):NaN]).filter(point=>Number.isFinite(point[1])),CHART_COLORS.price,2);
        ctx.restore();
        if(hasVolume){
          drawOptionVolume(ctx,visible,x,value=>bottom-value/vmax*(bottom-volumeTop),slot,contractType);
          drawHorizontalTicks(ctx,left,right,volumeTop,bottom,0,vmax);
          drawAxisLabels(ctx,{left,top:volumeTop,right,bottom,min:0,max:vmax,label:"Option Volume",steps:4,formatter:value=>abbreviate(value,1)});
        }
        drawAxisLabels(ctx,{left,top,right,bottom:mainBottom,min:pmin,max:pmax,formatter:chartStrikeLabel,label:presentation.leftAxisName});
        if(hasUnderlying)drawAxisLabels(ctx,{left,top,right,bottom:mainBottom,min:smin,max:smax,formatter:chartStrikeLabel,rightSide:true,label:"Underlying ($)"});
        drawTimeLabels(ctx,rows,state.start,state.end,left,right,bottom,domain);drawChartCrosshair(ctx,state,left,right,top,bottom);
      }
    });
    const first=rows[0],last=rows.at(-1);
    setSummary([["Open",formatPrice(first?.open)],["High",formatPrice(Math.max(...rows.map(row=>row.high)))],["Low",formatPrice(Math.min(...rows.map(row=>row.low)))],["Change",first?.close?`${((last.close/first.close-1)*100).toFixed(2)}%`:"—",last?.close>=first?.close?"positive":"negative"]]);
  }

  function renderContractStatsQuant(payload) {
    const data=payload.data||{},call=data.CALL||{},put=data.PUT||{};
    renderProportionBars("Contract Statistics",contractStatisticsRows(data));
    setSummary([["Call premium",compact(call.premium,true),"positive"],["Put premium",compact(put.premium,true),"negative"],["Call volume",compact(call.volume)],["Put volume",compact(put.volume)]]);
  }

  function renderProportionBars(title,rows,legend=[{label:"Calls",color:CHART_COLORS.call},{label:"Puts",color:CHART_COLORS.put}]) {
    let hits=[];
    quantCanvas({title,legend,items:rows,zoom:false,height:480,
      tooltipRows:(_,index,state)=>{const hit=hits.find(hit=>state.pointerY>=hit.y&&state.pointerY<=hit.y+hit.height),row=rows[hit?.index];return row?[row.label,`Puts ${compact(row.put,row.money)}`,`Calls ${compact(row.call,row.money)}`]:[];},
      draw:(ctx,w,h)=>{hits=drawProportionChart(ctx,w,h,rows,{formatValue:(value,row)=>title.includes('(Trade Count)')?abbreviate(value,0):compact(value,row.money),formatPercent:value=>(value*100).toFixed(2)+"%",primary:CHART_COLORS.primary,grid:CHART_COLORS.grid});}
    });
  }

  function renderSideStatsQuant(payload) {
    const data=payload.data||{},metric=getControl("sideMetric")==="VOLUME"?"volume":getControl("sideMetric")==="TRADE_COUNT"?"tradeCount":"premium";
    const sides=[["Above Ask","ABOVE_ASK"],["Ask","ASK"],["Mid Market","MID_MARKET"],["Bid","BID"],["Below Bid","BELOW_BID"]];
    const rows=sides.map(([label,key])=>({label,call:number(data.CALL?.[key]?.[metric]??(key==="MID_MARKET"?data.CALL?.MID?.[metric]:0)),put:number(data.PUT?.[key]?.[metric]??(key==="MID_MARKET"?data.PUT?.MID?.[metric]:0)),money:metric==="premium"}));
    const formatTotal=value=>metric==='tradeCount'?abbreviate(value,0):compact(value,metric==='premium');
    renderProportionBars(`Contract Side Statistics (${metric==="premium"?"Premium":metric==="volume"?"Volume":"Trade Count"})`,contractSideStatisticsRows(data,getControl("sideMetric")),[{label:"Calls",color:CHART_COLORS.call,value:formatTotal(rows.reduce((sum,row)=>sum+row.call,0))},{label:"Puts",color:CHART_COLORS.put,value:formatTotal(rows.reduce((sum,row)=>sum+row.put,0))}]);
    setSummary([["Metric",getControl("sideMetric")],["Calls",compact(rows.reduce((sum,row)=>sum+row.call,0),metric==="premium"),"positive"],["Puts",compact(rows.reduce((sum,row)=>sum+row.put,0),metric==="premium"),"negative"],["Trade sides",rows.length]]);
  }

  function renderMarketShareQuant(payload){
    const mode=getControl("shareMode")||"EQUITY_VOLUME",view=getControl("shareView")||"EXCHANGE",model=marketShareModel(payload.data||{},{mode,view}),money=mode.endsWith("PREMIUM"),bar=getControl("shareChart")==="bar";
    let pie=null,hits=[];
    quantCanvas({title:`Market Share (${MARKET_SHARE_MODES.find(entry=>entry[0]===mode)?.[1]||mode})`,items:model.entries,zoom:false,height:540,legend:[],
      tooltipRows:(_,index,state)=>{let entry;if(bar){const hit=hits.find(hit=>state.pointerY>=hit.y&&state.pointerY<=hit.y+hit.height);entry=model.barRows[hit?.index];}else if(pie){const dx=state.pointerX-pie.centerX,dy=state.pointerY-pie.centerY;if(Math.hypot(dx,dy)<=pie.radius){const fraction=((Math.atan2(dy,dx)+Math.PI/2+2*Math.PI)%(2*Math.PI))/(2*Math.PI);entry=model.entries[pie.cumulativeAngles.findIndex(end=>fraction<=end)];}}return entry?[entry.name,compact(entry.value,money),(entry.fraction*100).toFixed(2)+"%"]:[];},
      draw:(ctx,w,h)=>{if(bar)hits=drawMarketShareBars(ctx,w,h,model,{formatValue:value=>compact(value,money),formatPercent:value=>(value*100).toFixed(2)+"%",ticks:niceTicks(0,model.xMax,5),primary:CHART_COLORS.primary,grid:CHART_COLORS.grid});else pie=drawMarketSharePie(ctx,w,h,model.entries,{formatPercent:value=>(value*100).toFixed(2)+"%"});}
    });
    setSummary([[view==="EXCHANGE_GROUP"?"Exchange groups":"Exchanges",model.entries.length],["Total",compact(model.total,money)],["Data mode",MARKET_SHARE_MODES.find(entry=>entry[0]===mode)?.[1]],["View",view==="EXCHANGE_GROUP"?"Exchange group":"Exchange"]]);
  }


  function renderIvRankQuant(payload) {
    const rows=Object.entries(payload.data||{}).sort(([a],[b])=>a.localeCompare(b)).map(([date,row])=>({date,time:Date.parse(date),rank:averagedIvRank(row.contractTypeToIVData),spot:row.stockPrice==null?NaN:Number(row.stockPrice)})),ticker=String(getControl("ticker")||"QQQ").toUpperCase(),last=rows.at(-1)||{};
    quantCanvas({
      title:`Implied Volatility Rank - ${ticker}`,legend:[{label:"IV Rank",get color(){return themePaint("#FFFF00");},value:last.rank==null?"—":last.rank.toFixed(2)+"%"},{label:ticker,color:CHART_COLORS.primary,value:formatPrice(last.spot)}],items:rows,navigatorValues:rows.map(row=>row.rank),height:540,
      tooltipRows:row=>row?[row.date,`IV Rank ${row.rank==null?"—":row.rank.toFixed(2)+"%"}`,`${ticker} ${formatPrice(row.spot)}`]:[],
      draw:(ctx,w,h,state)=>{
        const left=78,right=w-78,top=8,bottom=h-20,visible=rows.slice(state.start,state.end+1),span=Math.max(1,visible.length-1),ranks=visible.map(row=>row.rank).filter(value=>value!=null&&Number.isFinite(value)),prices=visible.map(row=>row.spot).filter(Number.isFinite),rankDomain=niceValueDomain(Math.min(...ranks),Math.max(...ranks)),spotDomain=niceValueDomain(Math.min(...prices),Math.max(...prices)),{min:rmin,max:rmax}=rankDomain,{min:smin,max:smax}=spotDomain,x=index=>left+(right-left)*index/span,ry=value=>bottom-(value-rmin)/(rmax-rmin)*(bottom-top),sy=value=>bottom-(value-smin)/(smax-smin)*(bottom-top);
        ctx.font="bold 13px Aleph, sans-serif";ctx.fillStyle=themePaint("#FFFFFF");ctx.textBaseline="middle";ctx.textAlign="right";
        for(const value of rankDomain.ticks){const y=ry(value);ctx.strokeStyle=CHART_COLORS.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillText(Number(value.toFixed(2))+"%",left-8,y);}
        ctx.textAlign="left";for(const value of spotDomain.ticks)ctx.fillText(chartStrikeLabel(value),right+8,sy(value));
        quantLine(ctx,visible.map((row,index)=>[x(index),row.rank==null?NaN:ry(row.rank)]).filter(point=>Number.isFinite(point[1])),themePaint("#FFFF00"),2);
        quantLine(ctx,visible.map((row,index)=>[x(index),sy(row.spot)]).filter(point=>Number.isFinite(point[1])),CHART_COLORS.price,2);
        if(!toolConfiguration.hideAxisTitles){ctx.save();ctx.textAlign="center";ctx.translate(12,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText("Implied Volatility Rank",0,0);ctx.restore();ctx.save();ctx.translate(w-12,(top+bottom)/2);ctx.rotate(Math.PI/2);ctx.textAlign="center";ctx.fillText("Underlying ($)",0,0);ctx.restore();}
        ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
        ctx.fillStyle=themePaint("#FFFFFF");ctx.textAlign="center";ctx.textBaseline="top";for(let index=0;index<=4;index++){const row=rows[Math.min(state.end,Math.round(state.start+(state.end-state.start)*index/4))];if(row)ctx.fillText(new Date(row.date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),left+(right-left)*index/4,bottom+6);}drawChartCrosshair(ctx,state,left,right,top,bottom);
      }
    });
    setSummary([["Lookback",getControl("lookback")+" days"],["Maturity",getControl("maturity")+" days"],["IV Rank",last.rank==null?"—":last.rank.toFixed(1)+"%"],["Underlying",formatPrice(last.spot)]]);
  }

  function renderMaxPainQuant(payload) {
    const rows=Object.entries(payload.data||{}).map(([strike,row])=>({strike:Number(strike),call:number(row.callIntrinsicValue),put:number(row.putIntrinsicValue)})).filter(row=>Number.isFinite(row.strike)).sort((a,b)=>a.strike-b.strike),ticker=String(getControl("ticker")||"QQQ").toUpperCase(),pain=Number(payload.maxPainStrikePrice),spot=Number(payload.stockPrice);
    let bounds=null;
    quantCanvas({
      title:`Max Pain - ${ticker}`,legend:[{label:"Calls",color:CHART_COLORS.call},{label:"Puts",color:CHART_COLORS.put},{label:ticker,color:CHART_COLORS.primary,value:formatPrice(spot)}],items:rows,navigatorValues:rows.map(row=>row.call+row.put),height:540,
      tooltipRows:(row,index,state)=>{if(bounds){let nearest=state.start;for(let i=state.start;i<=state.end;i++)if(Math.abs(bounds.categoryPixel(rows[i],i)-state.pointerX)<Math.abs(bounds.categoryPixel(rows[nearest],nearest)-state.pointerX))nearest=i;row=rows[nearest];state.hover=nearest;}return row?[chartStrikeLabel(row.strike),`Call Intrinsic Value: ${compact(row.call,true)}`,`Put Intrinsic Value: ${compact(row.put,true)}`]:[];},
      draw:(ctx,w,h,state)=>{
        bounds=drawExposureBars(ctx,w,h,rows,{display:"SPLIT",fromZero:true,grouped:true,start:state.start,end:state.end,axisName:"Intrinsic Value ($)",categoryFormatter:point=>chartStrikeLabel(point.strike),valueFormatter:value=>compact(value,true),markers:[{value:pain,color:MAX_PAIN_STYLES.maxPainMarker,width:2,label:"Max Pain: "+formatPrice(pain),labelPosition:"middle"},{value:spot,color:CHART_COLORS.primary,width:2,label:"Last Price: "+formatPrice(spot),labelPosition:"end"}],hover:toolConfiguration.hideCrosshairs?null:state.hover,hideAxisTitles:toolConfiguration.hideAxisTitles,pointerX:state.pointerX,pointerY:state.pointerY});
      }
    });
    setSummary([["Max pain",formatPrice(pain)],["Underlying",formatPrice(spot)],["Expiration",getControl("expiry")],["Strikes",rows.length]]);
  }

  function renderMaxPainTimeQuant(payload) {
    const rows=Object.entries(payload.data||{}).map(([date,value])=>({date,time:Date.parse(date),value:Number(value)})).filter(row=>Number.isFinite(row.value)).sort((a,b)=>a.time-b.time),ticker=String(getControl("ticker")||"QQQ").toUpperCase(),spot=parsePrices({data:payload.stock||{}}).at(-1)?.spot;
    quantCanvas({
      title:`Max Pain / Time - ${ticker}`,legend:[{label:"Max Pain Strike Prices",color:CHART_COLORS.primary},...(Number.isFinite(spot)?[{label:ticker,get color(){return themePaint("#FFFFFF");},value:formatPrice(spot)}]:[])],items:rows,navigatorValues:rows.map(row=>row.value),height:540,
      tooltipRows:row=>row?[row.date,"Max Pain "+formatPrice(row.value)]:[],
      draw:(ctx,w,h,state)=>{
        const left=94,right=w-28,top=8,bottom=h-20,visible=rows.slice(state.start,state.end+1),span=Math.max(1,visible.length-1),values=[...visible.map(row=>row.value),...(Number.isFinite(spot)?[spot]:[])],{min,max,ticks}=niceValueDomain(Math.min(...values),Math.max(...values)),x=index=>left+(right-left)*index/span,y=value=>bottom-(value-min)/(max-min)*(bottom-top);
        ctx.font="bold 13px Aleph, sans-serif";ctx.fillStyle=themePaint("#FFFFFF");ctx.textBaseline="middle";ctx.textAlign="right";for(const value of ticks){const py=y(value);ctx.strokeStyle=CHART_COLORS.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.fillText(chartStrikeLabel(value),left-8,py);}
        quantLine(ctx,visible.map((row,index)=>[x(index),y(row.value)]),CHART_COLORS.price,2);
        ctx.fillStyle=themePaint("#FFFFFF");ctx.textAlign="center";ctx.textBaseline="bottom";
        for(let index=0;index<visible.length;index++){const row=visible[index];ctx.fillText(currencyAuto(row.value),x(index),Math.max(top+14,y(row.value)-5));}
        if(!toolConfiguration.hideAxisTitles){ctx.save();ctx.textAlign="center";ctx.translate(12,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText("Strike Price ($)",0,0);ctx.restore();}
        if(Number.isFinite(spot)){ctx.strokeStyle=MAX_PAIN_STYLES.timeSpotMarker;ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(left,y(spot));ctx.lineTo(right,y(spot));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=MAX_PAIN_STYLES.timeSpotMarker;ctx.textAlign="right";ctx.fillText("Last Price: "+formatPrice(spot),right-6,y(spot)-8);}
        ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
        ctx.fillStyle=themePaint("#FFFFFF");ctx.textAlign="center";ctx.textBaseline="top";for(let index=0;index<=4;index++){const row=rows[Math.min(state.end,Math.round(state.start+(state.end-state.start)*index/4))];if(row)ctx.fillText(new Date(row.date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),left+(right-left)*index/4,bottom+6);}drawChartCrosshair(ctx,state,left,right,top,bottom);
      }
    });
    setSummary([["Expirations",rows.length],["Front expiration",rows[0]?.date||"—"],["Front max pain",formatPrice(rows[0]?.value)],["Underlying",formatPrice(spot)]]);
  }

  function flattenRow(row, prefix = "", output = {}) {
    for (const [key, value] of Object.entries(row || {})) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(output).length < 40) flattenRow(value, name, output);
      else output[name] = Array.isArray(value) ? value.join(", ") : value;
    }
    return output;
  }

  function showTable(rows,columns=null,totalRow=null,configuration={}) {
    tableColumns=columns;
    q("#toolVisual").hidden = true; q("#chartToolbar").hidden = true; q("#toolTableWrap").hidden = false;
    tableRows = rows;
    if(!tableRuntime)tableRuntime=createTableView({table:q("#toolTable"),search:q("#tableSearch"),count:q("#tableCount"),columnHost:q("#tableColumnControls"),storage:{getItem:key=>gexStorage.getItem('gex-data:'+instanceKey+':'+key),setItem:(key,value)=>gexStorage.setItem('gex-data:'+instanceKey+':'+key,value)},onRowClick:(row,event)=>{
      const tr=event.target.closest("tr");if(!tr)return;const next=tr.nextElementSibling;if(next?.classList.contains("detail-row")){next.remove();return;}const detail=element("tr","detail-row"),cell=element("td","row-detail"),actions=element("div","row-detail-actions");cell.colSpan=tableRuntime.getColumns().filter(column=>column.visible).length;
      if(row.ticker){const button=element("button","",row.osi||row.expirationDate?"View contract chart":"View stock chart");button.type="button";button.addEventListener("click",()=>{const id=row.osi||row.expirationDate?"option-price-over-time":"stock-price-over-time";savedToolControls[id]={...savedToolControls[id],mode:getControl("mode"),date:getControl("date"),ticker:row.ticker,osi:row.osi||"",expiry:row.expirationDate||"",strike:row.strikePrice??"",contractType:row.contractType||"CALL"};showTool(id);});actions.append(button);}
      cell.append(actions,element("pre","",JSON.stringify(row,null,2)));detail.append(cell);tr.after(detail);
    }});
    const schema=columns||[...new Set(rows.flatMap(row=>Object.keys(row)))].map(key=>({key,label:key,type:typeof rows.find(row=>row[key]!=null)?.[key]==="number"?"decimal":"text"}));
    tableRuntime.setRows(rows,{columns:schema,totalRow,toolId:activeTool.id,sortKey:configuration.sortKey,sortDirection:configuration.sortDirection});
    q("#loadMore").hidden = !toolCursor;
  }

  function renderFlowStatistics(statistics){
    if(!statistics)return;const model=flowStatisticsModel(statistics),holder=element("div","flow-statistics"),circumference=2*Math.PI*40;
    for(const ring of model.rings){const item=element("div","flow-statistic"),svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("aria-hidden","true");const circle=(color,length,offset=0)=>{const node=document.createElementNS("http://www.w3.org/2000/svg","circle");for(const [key,value] of Object.entries({cx:50,cy:50,r:40,fill:"none",stroke:color,"stroke-width":20,"stroke-dasharray":`${length} ${circumference}`,"stroke-dashoffset":-offset,"stroke-linecap":"round",transform:"rotate(90 50 50)"}))node.setAttribute(key,value);svg.append(node);};circle(themePaint("#e6e6e6"),circumference);let offset=0;for(const segment of ring.segments){if(segment.value>0)circle(segment.color,circumference*segment.value/100,offset);offset+=circumference*segment.value/100;}const text=element("span");text.append(element("small","",ring.title),element("b","",ring.label??(ring.percentage!=null?ring.percentage.toFixed(2)+"%":`${compact(ring.put,ring.id==="premium")} / ${compact(ring.call,ring.id==="premium")}`)));item.append(svg,text);holder.append(item);}
    q("#toolTableWrap").prepend(holder);
  }

  function renderTableRows() {tableRuntime?.render();}


  function renderHeatMap(payload) {
    showVisual();
    const data=payload.data||{},mode=getControl("heatMetric")||"NET_GAMMA_EXPOSURE",metric=heatMetricFor(mode),ticker=String(getControl("ticker")||"QQQ").toUpperCase(),invert=getControl("heatAxes")==="INVERTED",expiries=Object.keys(data).sort(),cells=[],matrix=new Map();
    for(const expiry of expiries){const row=new Map();for(const [strikeKey,raw] of Object.entries(data[expiry]||{})){const strike=Number(strikeKey);if(!Number.isFinite(strike))continue;const cell={expiry,strike,value:heatCellValue(raw,mode)};cells.push(cell);row.set(strike,cell);}matrix.set(expiry,row);}
    const strikes=[...new Set(cells.map(cell=>cell.strike))].sort((a,b)=>a-b),mvc=metric?.supportsMVC?cells.reduce((best,cell)=>!best||Math.abs(cell.value)>Math.abs(best.value)?cell:best,null):null,scaleValues=cells.filter(cell=>cell!==mvc).map(cell=>cell.value),positiveMax=Math.max(0,...scaleValues),negativeMin=Math.min(0,...scaleValues),spot=Number(payload._spot);
    const initial=heatMapInitialWindow(q("#toolVisual").clientWidth,540,expiries,strikes,spot,invert),horizontal=invert?strikes:expiries,vertical=invert?expiries:strikes;
    const initialWindow=initial?{start:initial.horizontal[0],end:initial.horizontal[1],yWindow:initial.vertical.map(index=>index/Math.max(1,vertical.length-1))}:null;
    // Licensed heat IV, like consolidated IV, is already percentage points.
    const formatValue=value=>metric?.format==="currency"?compact(value,true):metric?.format==="percent"?value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+"%":metric?.format==="decimal"?value.toFixed(5):compact(value);
    const formatExpiry=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const legend=[...(mvc?[{label:`MVC (${chartStrikeLabel(mvc.strike)} ${formatExpiry(mvc.expiry)})`,get color(){return themePaint("#7D1AD6");}}]:[]),...(Number.isFinite(spot)?[{label:ticker,color:CHART_COLORS.primary,value:formatPrice(spot)}]:[])];let bounds=null;
    const preview=horizontal.map(item=>cells.filter(cell=>invert?cell.strike===item:cell.expiry===item).reduce((max,cell)=>Math.max(max,Math.abs(cell.value)),0));
    const verticalPreview=vertical.map(item=>cells.filter(cell=>invert?cell.expiry===item:cell.strike===item).reduce((max,cell)=>Math.max(max,Math.abs(cell.value)),0));
    quantCanvas({title:`${metric?.label||mode} Heat Map - ${ticker}`,legend,items:horizontal,navigatorValues:preview,verticalValues:verticalPreview,twoDimensional:true,initialWindow,height:540,plotLeft:invert?128:88,plotRight:50,
      onClick:(_,index,state)=>{if(!bounds)return;const xi=Math.floor(bounds.xmin+(state.pointerX-bounds.left)/(bounds.right-bounds.left)*(bounds.xmax-bounds.xmin)),yi=Math.floor(bounds.ymax-(state.pointerY-bounds.top)/(bounds.bottom-bounds.top)*(bounds.ymax-bounds.ymin)),expiry=invert?vertical[yi]:horizontal[xi],strike=invert?horizontal[xi]:vertical[yi],cell=matrix.get(expiry)?.get(strike);if(!cell)return;openTradeDetail({title:'Heat Map Cell Data',preview:`${ticker} · ${formatExpiry(expiry)} · ${chartStrikeLabel(strike)} · ${metric?.label}: ${formatValue(cell.value)}`,filter:{ticker,expirationDates:[expiry],strikePrices:[strike]}});},
      tooltipRows:(_,index,state)=>{if(!bounds||state.pointerX<bounds.left||state.pointerX>bounds.right||state.pointerY<bounds.top||state.pointerY>bounds.bottom)return[];const xi=Math.floor(bounds.xmin+(state.pointerX-bounds.left)/(bounds.right-bounds.left)*(bounds.xmax-bounds.xmin)),yi=Math.floor(bounds.ymax-(state.pointerY-bounds.top)/(bounds.bottom-bounds.top)*(bounds.ymax-bounds.ymin)),expiry=invert?vertical[yi]:horizontal[xi],strike=invert?horizontal[xi]:vertical[yi],cell=matrix.get(expiry)?.get(strike);return expiry&&strike!=null?[`${ticker} · ${formatExpiry(expiry)}`,chartStrikeLabel(strike),`${metric?.label}: ${cell?formatValue(cell.value):"No data"}`]:[];},
      draw:(ctx,w,h,state)=>{
        const left=invert?128:88,right=w-50,top=10,bottom=h-34,xmin=state.start,xmax=state.end+1,ymin=state.yWindow[0]*Math.max(1,vertical.length-1),ymax=state.yWindow[1]*Math.max(1,vertical.length-1)+1,cw=(right-left)/Math.max(1,xmax-xmin),ch=(bottom-top)/Math.max(1,ymax-ymin),x=index=>left+(index-xmin)*cw,y=index=>bottom-(index-ymin)*ch;bounds={left,right,top,bottom,xmin,xmax,ymin,ymax};
        ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();ctx.font="700 11px Aleph, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
        for(let xi=state.start;xi<=state.end;xi++)for(let yi=Math.floor(ymin);yi<=Math.min(vertical.length-1,Math.ceil(ymax));yi++){const expiry=invert?vertical[yi]:horizontal[xi],strike=invert?horizontal[xi]:vertical[yi],cell=matrix.get(expiry)?.get(strike);if(!cell||!cell.value)continue;ctx.fillStyle=heatCellColor(cell.value,mode,positiveMax,negativeMin,cell===mvc);ctx.fillRect(x(xi),y(yi+1),cw,ch);const text=formatValue(cell.value);if(ch>=14&&ctx.measureText(text).width<cw-4){ctx.fillStyle=themePaint("#fff");ctx.fillText(text,x(xi)+cw/2,y(yi+.5));}}
        ctx.restore();ctx.fillStyle=themePaint("#fff");ctx.font="700 13px Aleph, sans-serif";ctx.textBaseline="middle";ctx.textAlign="right";const everyY=Math.max(1,Math.ceil(23/ch));for(let yi=Math.ceil(ymin);yi<=Math.min(vertical.length-1,Math.floor(ymax));yi+=everyY)ctx.fillText(invert?formatExpiry(vertical[yi]):chartStrikeLabel(vertical[yi]),left-8,y(yi+.5));
        ctx.textAlign="center";const everyX=Math.max(1,Math.ceil((invert?65:110)/cw));for(let xi=state.start;xi<=state.end;xi+=everyX)ctx.fillText(invert?chartStrikeLabel(horizontal[xi]):formatExpiry(horizontal[xi]),x(xi)+cw/2,bottom+19);
        ctx.strokeStyle=CHART_COLORS.primary;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
      }
    });
    setSummary([["Mode",metric?.label||mode],["Expirations",expiries.length],["Strikes",strikes.length],["Active cells",cells.filter(cell=>cell.value!==0).length.toLocaleString()]]);
  }


  function renderMarketMap(payload) {
    const entries=Object.entries(payload.data||{}).map(([ticker,row])=>({ticker,...row,weight:number(row.size),change:number(row.previousValue)?(number(row.currentValue)/number(row.previousValue)-1)*100:0})).filter(row=>row.weight>0);
    const grouping=getControl("mapGroup")||"SECTOR",groups=new Map();for(const row of entries){const sector=grouping==="NONE"?"Market":grouping==="INDUSTRY"?row.industry||"Other":row.sector||"Other";if(!groups.has(sector))groups.set(sector,[]);groups.get(sector).push(row);}
    const sectors=[...groups.entries()].map(([name,rows])=>({name,rows,weight:rows.reduce((sum,row)=>sum+row.weight,0)}));let hits=[],headers=[],mapDrag=null,camera={...MARKET_MAP_CAMERA_IDENTITY},mapWidth=1,mapHeight=1,maxZoom=50,horizontalNavigation,verticalNavigation;
    try{const saved=JSON.parse(gexStorage.getItem(`gex-data-market-map-camera:${instanceKey}`));if(saved&&['zoomX','zoomY','offsetX','offsetY'].every(key=>Number.isFinite(saved[key])))camera=saved;}catch{}
    const saveCamera=()=>{try{gexStorage.setItem(`gex-data-market-map-camera:${instanceKey}`,JSON.stringify(camera));}catch{}};
    const chart=quantCanvas({
      title:"Market Map",items:entries,zoom:false,height:620,legend:[],
      tooltipRows:(_,index,state)=>{const {x:px,y:py}=marketMapWorldPoint(camera,state.pointerX,state.pointerY),hit=hits.find(rect=>px>=rect.x&&px<=rect.x+rect.width&&py>=rect.y&&py<=rect.y+rect.height);return hit?[`${hit.item.ticker} · ${hit.item.companyName||""}`,`${formatPrice(hit.item.currentValue)} · ${hit.item.change>=0?"+":""}${hit.item.change.toFixed(2)}%`,`Market cap ${compact(hit.item.weight,true)}`,`${hit.item.sector||""} · ${hit.item.industry||""}`]:[];},
      draw:(ctx,w,h)=>{
        mapWidth=w;mapHeight=h;camera=clampMarketMapCamera(camera,w,h,maxZoom);hits=[];headers=[];ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.translate(camera.offsetX,camera.offsetY);ctx.scale(camera.zoomX,camera.zoomY);const groupRects=squarifyTreemap(sectors,{x:0,y:0,width:w,height:h});
        for(const group of groupRects){
          const band=grouping==="NONE"?0:Math.min(16,group.height*.25);if(band){ctx.fillStyle=themePaint("#281047");ctx.fillRect(group.x,group.y,group.width,band);ctx.fillStyle=themePaint("#FFFFFF");ctx.font="700 10px Aleph, sans-serif";ctx.textAlign="left";ctx.save();ctx.beginPath();ctx.rect(group.x,group.y,group.width,band);ctx.clip();ctx.fillText(group.item.name.replaceAll("_"," "),group.x+4,group.y+band-4);ctx.restore();headers.push({...group,height:band});}
          const tiles=squarifyTreemap(group.item.rows,{x:group.x,y:group.y+band,width:group.width,height:Math.max(0,group.height-band)});
          for(const tile of tiles){ctx.fillStyle=marketMapColor(tile.item.change);ctx.fillRect(tile.x,tile.y,tile.width,tile.height);ctx.strokeStyle=themePaint("#0C0216");ctx.lineWidth=.5;ctx.strokeRect(tile.x,tile.y,tile.width,tile.height);hits.push(tile);if(tile.width<32||tile.height<32)continue;ctx.save();ctx.beginPath();ctx.rect(tile.x+2,tile.y+2,tile.width-4,tile.height-4);ctx.clip();ctx.fillStyle=themePaint("#FFFFFF");ctx.textAlign="center";const font=Math.min(26,Math.max(10,Math.min(tile.width/4,tile.height/4)));ctx.font=`750 ${font}px Aleph, sans-serif`;ctx.fillText(tile.item.ticker,tile.x+tile.width/2,tile.y+tile.height/2-2);ctx.font=`700 ${Math.min(14,font*.7)}px Aleph, sans-serif`;ctx.fillText(`${tile.item.change>=0?"+":""}${tile.item.change.toFixed(2)}%`,tile.x+tile.width/2,tile.y+tile.height/2+font*.8);ctx.restore();}
        }
        ctx.restore();maxZoom=marketMapMaxZoom(hits);horizontalNavigation?.sync();verticalNavigation?.sync();
      }
    });
    chart.shell.classList.add('market-map-chart','two-dimensional-chart');
    const horizontal=element('div','quant-navigator market-map-horizontal'),vertical=element('div','quant-vertical-navigator market-map-vertical');chart.shell.append(horizontal);chart.canvas.parentElement.append(vertical);
    const updateWindow=(axis,window)=>{camera=applyMarketMapWindow(camera,axis,window,mapWidth,mapHeight,maxZoom);saveCamera();chart.redraw();};
    horizontalNavigation=bindZoomNavigator({host:horizontal,length:MARKET_MAP_SLIDER_MAX+1,fractional:true,minSpan:0,label:'Market map horizontal window',getWindow:()=>(marketMapCameraWindows(camera,mapWidth,mapHeight)?.horizontal??{start:0,end:MARKET_MAP_SLIDER_MAX}),setWindow:window=>updateWindow('horizontal',window)});
    verticalNavigation=bindZoomNavigator({host:vertical,length:MARKET_MAP_SLIDER_MAX+1,vertical:true,inverted:false,fractional:true,minSpan:0,label:'Market map vertical window',getWindow:()=>(marketMapCameraWindows(camera,mapWidth,mapHeight)?.vertical??{start:0,end:MARKET_MAP_SLIDER_MAX}),setWindow:window=>updateWindow('vertical',window)});
    activeChartReset=()=>{camera={...MARKET_MAP_CAMERA_IDENTITY};saveCamera();chart.redraw();};
    chart.canvas.addEventListener('wheel',event=>{const rect=chart.canvas.getBoundingClientRect(),result=wheelMarketMapCamera(camera,{x:event.clientX-rect.left,y:event.clientY-rect.top,deltaY:event.deltaY,width:mapWidth,height:mapHeight,maxZoom});if(!result.handled)return;event.preventDefault();camera=result.camera;saveCamera();chart.redraw();},{passive:false});
    chart.canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;mapDrag={x:event.clientX,y:event.clientY,camera:{...camera},panning:false};chart.canvas.setPointerCapture(event.pointerId);});
    chart.canvas.addEventListener('pointermove',event=>{if(!mapDrag)return;if(!mapDrag.panning){if(Math.abs(event.clientX-mapDrag.x)+Math.abs(event.clientY-mapDrag.y)<=3)return;mapDrag.panning=true;mapDrag.x=event.clientX;mapDrag.y=event.clientY;return;}camera=panMarketMapCamera(mapDrag.camera,event.clientX-mapDrag.x,event.clientY-mapDrag.y,mapWidth,mapHeight,maxZoom);saveCamera();chart.redraw();});
    chart.canvas.addEventListener('pointerup',event=>{if(mapDrag&&!mapDrag.panning&&grouping!=='NONE'){const rect=chart.canvas.getBoundingClientRect(),{x:px,y:py}=marketMapWorldPoint(camera,event.clientX-rect.left,event.clientY-rect.top),hit=headers.find(header=>px>=header.x&&px<=header.x+header.width&&py>=header.y&&py<=header.y+header.height);if(hit){setControl(grouping==='SECTOR'?'sector':'industry',hit.item.name.toUpperCase().replaceAll(' ','_'));if(grouping==='SECTOR')setControl('industry','');onControlsChanged();}}mapDrag=null;});
    chart.canvas.addEventListener('pointercancel',()=>{mapDrag=null;});chart.canvas.addEventListener('pointerleave',()=>{mapDrag=null;});chart.redraw();
    const up=entries.filter(row=>row.change>0).length;setSummary([["Symbols",entries.length.toLocaleString()],["Advancing",up.toLocaleString(),"positive"],["Declining",(entries.length-up).toLocaleString(),"negative"],["Sectors",sectors.length]]);
  }

  function aggregateExposureTool(payload) {
    const ticker = String(getControl("ticker") || "QQQ").toUpperCase(); return aggregateExposure(payload, ticker);
  }

  function renderIntervalMap(payload) {
    return renderIntervalMapQuant(payload);
  }

  function renderForecast() {
    showVisual();q("#chartToolbar").hidden=true;
    const message=element("div","source-unavailable");
    message.append(element("h2","","Exposure Forecast"),element("p","","The licensed market-data forecast feed is not connected. No forecast data is available."));
    q("#toolVisual").replaceChildren(message);setSummary([]);
  }

  function renderToolPayload(tool, payload, {refresh=false}={}) {
    if(refresh&&tool.view==='netDrift'&&activeChartUpdate?.(payload))return;
    resetStage(); const data = payload.data || {};
    if (tool.view === "table") {
      const rows=Array.isArray(data)?data:Object.entries(data).map(([key,row])=>({key,...(row||{})})),historical=getControl("mode")==="historical";
      let schema=tool.id==="order-flow-consolidated"?CONSOLIDATED_COLUMNS.filter(column=>column.id!=="date"||historical):tool.id==="equity-prints"?EQUITY_PRINT_COLUMNS:EXCHANGE_NOTIFICATION_COLUMNS;
      if(tool.id!=="order-flow-consolidated")schema=schema.filter(column=>!column.historicalOnly||historical).map(column=>({...column,id:column.key,key:column.timeField||column.key,type:column.key==="date"?"date":/Time$/.test(column.key)?"time":column.key==="bidAsk"?"bidAsk":column.key==="notionalValue"||column.key==="price"?"money":column.key==="size"?"integer":"text",...(column.key==="notionalValue"?{dot:row=>`var(${equitySideColorToken(row)||"--qd-dot-sentimentNeutralColor"},#AAAAAA)`}:column.key==="ticker"&&tool.id==="equity-prints"?{dot:row=>`var(${equityPrintColorToken(row)||"--qd-dot-equityLitPoolColor"},#AAAAAA)`}:column.key==="type"?{dot:row=>`var(${notificationColorToken(row.type)||"--qd-dot-exchangeNotificationNeutralColor"},#AAAAAA)`}:{})}));
      showTable(rows,schema);if(tool.id==="order-flow-consolidated")renderFlowStatistics(payload.statistics);setSummary([["Loaded rows",rows.length.toLocaleString()],["Session",historical?getControl("date"):"Latest"],["Ticker",getControl("ticker")||getControl("tickerOptional")||"All"],["More pages",payload.nextSearchAfter?"Available":"No"]]);return;
    }
    if (tool.view === "marketMap") return renderMarketMap(payload);
    if (tool.view === "heatMap") return renderHeatMap(payload);
    if (tool.view === "intervalMap") return renderIntervalMap(payload);
    if (tool.view === "forecast") return renderForecast(payload);

    if (tool.view === "darkFlow") {
      renderDarkFlowQuant(payload); return;
    }
    if (tool.view === "darkLevels") {
      renderDarkLevelsQuant(payload); return;
    }
    if (tool.view === "ohlc" || tool.view === "optionOhlc") {
      renderOhlcQuant(payload,tool); return;
    }
    if (tool.view === "contractStats") {
      renderContractStatsQuant(payload); return;
    }
    if (tool.view === "sideStats") {
      renderSideStatsQuant(payload); return;
    }
    if (tool.view === "gainers") {
      const model=gainersModel(data,getControl("rankMetric")||"bullishPremium"),rows=model.rows;showTable(rows,GAINERS_COLUMNS,null,{sortKey:getControl("rankMetric")||"bullishPremium"});const top=rows[0];setSummary([["Symbols",rows.length.toLocaleString()],["Leader",top?.ticker||"—"],["Bullish premium",compact(rows.reduce((s,r)=>s+number(r.bullishPremium),0),true),"positive"],["Bearish premium",compact(rows.reduce((s,r)=>s+number(r.bearishPremium),0),true),"negative"]]);return;
    }
    if (tool.view === "marketShare" || tool.view === "marketShareTable") {
      if(tool.view==="marketShareTable"){const model=marketShareTableModel(data),rows=model.rows;showTable(rows,MARKET_SHARE_COLUMNS,model.totalRow,{sortKey:"equityTotalVolume"});setSummary([["Exchanges",rows.length],["Total premium",compact(model.totals.totalPremium,true)],["Equity calls",compact(rows.reduce((s,r)=>s+number(r.equityCallPremium),0),true),"positive"],["Equity puts",compact(rows.reduce((s,r)=>s+number(r.equityPutPremium),0),true),"negative"]]);}else renderMarketShareQuant(payload);return;
    }
    if (tool.view === "exposureStrike") {
      renderExposureProfileQuant(payload,false); return;
    }
    if (tool.view === "exposureExpiration") {
      renderExposureProfileQuant(payload,true); return;
    }
    if (tool.view === "ivRank") {
      renderIvRankQuant(payload); return;
    }
    if (tool.view === "maxPain") {
      renderMaxPainQuant(payload); return;
    }
    if (tool.view === "maxPainTime") {
      renderMaxPainTimeQuant(payload); return;
    }
    if (tool.view === "netDrift") {
      renderNetDriftQuant(payload); return;
    }
  }

  function exportCsv() {
    if (!activeTool || !toolPayload) return;
    let rows = tableRows.length ? tableRows.map(row=>flattenRow(row)) : Array.isArray(toolPayload.data) ? toolPayload.data.map((row)=>flattenRow(row)) : Object.entries(toolPayload.data || {}).map(([key,row])=>flattenRow({key,...(typeof row==="object"?row:{value:row})}));
    if (!rows.length) return; const keys=[...new Set(rows.flatMap(Object.keys))], quote=(value)=>`"${String(value??"").replaceAll('"','""')}"`; const csv=[keys.map(quote).join(","),...rows.map(row=>keys.map(key=>quote(row[key])).join(","))].join("\n"); const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); const a=document.createElement("a");a.href=url;a.download=`gex-data-${activeTool.id}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  const workspaceController=bootWorkspace({tools:TOOL_DEFINITIONS,showBoard,openTool:showTool});
  workspaceController?.visibility(!location.hash.startsWith('#tool='));
  q("#openLibrary").addEventListener("click", () => openLibrary(!library.classList.contains("open")));
  q("#addTool").addEventListener("click", event => {if(workspaceController&&dashboard.hidden===false)workspaceController.addTool(event.currentTarget);else openLibrary(true);}); q("#closeLibrary").addEventListener("click", () => openLibrary(false)); scrim.addEventListener("click", () => openLibrary(false));
  q("#toolSearch").addEventListener("input", (event) => renderToolNav(event.target.value)); q("#backBoard").addEventListener("click", showBoard); q("#toolRefresh").addEventListener("click", () => loadActiveTool()); q("#toolExport").addEventListener("click", exportCsv); q("#resetZoom").addEventListener("click", () => activeChartReset?.()); q("#tableSearch").addEventListener("input", renderTableRows); q("#loadMore").addEventListener("click", () => loadActiveTool({ append: true }));

  let closingReconcileAt=0;
  async function refreshMarketStatus() {
    if(window.__gexDataActive===false||document.hidden||!frameVisible)return;
    const wasOpen=toolMarketOpen();
    try { apiStatus = await fetchJson("/api/gex-data/status"); updateLiveState();
      if(wasOpen&&!toolMarketOpen()){closingReconcileAt=Date.now()+60000;if(activeTool&&getControl('mode')!=='historical')loadActiveTool();}
      else if(closingReconcileAt&&Date.now()>=closingReconcileAt){closingReconcileAt=0;if(activeTool&&getControl('mode')!=='historical')loadActiveTool();}
      schedulePoll(); } catch { /* Keep errors until a real data request succeeds. */ }
  }
  const statusTimer=setInterval(refreshMarketStatus, 60000); renderToolNav();
  const activityChanged=()=>{if(window.__gexDataActive===false||document.hidden){clearTimeout(pollTimer);pollTimer=null;activeController?.abort();}else{refreshMarketStatus();if(activeTool&&!toolPayload)loadActiveTool();schedulePoll();}};
  window.addEventListener('gex-data-activity',activityChanged);document.addEventListener('visibilitychange',activityChanged);
  window.addEventListener('pagehide',()=>{clearInterval(statusTimer);clearTimeout(pollTimer);activeController?.abort();activeChartDispose?.();tableRuntime?.destroy();});
  window.addEventListener('gex-data-timezone',refreshTimeZonePresentation);
  const preferenceFilterSignature=()=>JSON.stringify({overrides:getFilterOverrides(),groups:getFilterGroups().map(group=>({id:group.id,expression:group.expression}))});
  const preferencePresentationSignature=()=>JSON.stringify([toolConfiguration,document.documentElement.getAttribute('style'),document.documentElement.className]);
  let lastFilterSignature=preferenceFilterSignature();
  let lastPresentationSignature=preferencePresentationSignature();
  const preferencesChanged=()=>{
    toolConfiguration=applyDocumentPreferences();
    const signature=preferenceFilterSignature(),presentation=preferencePresentationSignature(),presentationChanged=presentation!==lastPresentationSignature;
    lastPresentationSignature=presentation;
    if(signature!==lastFilterSignature){lastFilterSignature=signature;reflectFilterOverrides();syncDateControl();if(activeTool)loadActiveTool();}
    else if(presentationChanged&&activeTool&&toolPayload){renderToolPayload(activeTool,toolPayload);renderSnapshotControl(toolPayload);}
  };
  window.addEventListener('storage',preferencesChanged);window.addEventListener('gex-data-preferences',preferencesChanged);
  window.addEventListener('message',event=>{if(!EMBEDDED||event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='gex-data-preferences')preferencesChanged();if(event.data?.type==='gex-data-refresh')loadActiveTool();if(event.data?.type==='gex-data-save-state')saveToolControls();if(event.data?.type==='gex-data-visibility'){frameVisible=event.data.visible===true;if(frameVisible){if(activeTool&&!toolPayload)loadActiveTool();schedulePoll();}else{clearTimeout(pollTimer);pollTimer=null;activeController?.abort();}}});
  window.addEventListener("hashchange", () => {
    const id = location.hash.startsWith("#tool=") ? location.hash.slice(6) : null;
    if (id && toolMap.has(id) && activeTool?.id !== id) showTool(id);
    else if (!id && activeTool) showBoard();
  });
  const initialTool = location.hash.startsWith("#tool=") ? location.hash.slice(6) : null;
  if (toolMap.has(initialTool)) setTimeout(() => showTool(initialTool), 0);
}
