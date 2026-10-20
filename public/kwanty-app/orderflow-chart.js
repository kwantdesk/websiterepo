import {themePaint,themeInk} from './site-theme.js';
import {botStorage,botFetch} from './site-runtime.js';
// Independent implementation of the observed shipped Orderflow semantics.
// Inputs are native REST units, NOT the website's scaled protobuf transport.
export const ORDERFLOW_METRICS = Object.freeze({
  'net-convexity': { label: 'Net Convexity', fields: ['zcvr', 'ocvr'], get colors(){return [themePaint("cyan"), themePaint("#ae4ad5"), themePaint("#008B8B"), themePaint("#800080")];} },
  'net-gex': { label: 'Net GEX', fields: ['zgr', 'ogr'], get colors(){return [themePaint("#00ff00"), themePaint("#ff0000"), themePaint("#006400"), themePaint("#8B0000")];} },
  'net-vanna': { label: 'Net Vanna', fields: ['zvanna', 'ovanna'], get colors(){return [themePaint("#3682f0"), themePaint("#ae4ad5"), themePaint("#1e4c8c"), themePaint("#800080")];}, noCombine: true },
  'net-charm': { label: 'Net Charm', fields: ['zcharm', 'ocharm'], get colors(){return [themePaint("#DAA520"), themePaint("#ae4ad5"), themePaint("#B8860B"), themePaint("#800080")];}, noCombine: true },
  'aggregate-dex': { label: 'Aggregate DEX', fields: ['agg_dex', 'one_agg_dex'], get colors(){return [themePaint("cyan"), themePaint("#ae4ad5"), themePaint("#008B8B"), themePaint("#800080")];} },
  'dex-orderflow': { label: 'DEX Orderflow', fields: ['dexoflow', 'one_dexoflow'], get colors(){return [themePaint("magenta"), themePaint("orange"), themePaint("orange"), themePaint("#1e4c8c")];}, flow: true },
  'gex-orderflow': { label: 'GEX Orderflow', fields: ['gexoflow', 'one_gexoflow'], get colors(){return [themePaint("yellow"), themePaint("red"), themePaint("red"), themePaint("#006400")];}, flow: true },
  'convexity-orderflow': { label: 'Convexity Orderflow', fields: ['cvroflow', 'one_cvroflow'], get colors(){return [themePaint("cyan"), themePaint("#ae4ad5"), themePaint("magenta"), themePaint("#008B8B")];}, flow: true }
});

const DEX_CHILDREN = {
  'agg-call-dex': { label: 'Aggregate Call DEX', fields: ['agg_call_dex', 'one_agg_call_dex'], get colors(){return [themePaint("lime"), themePaint("orange"), themePaint("#006400"), themePaint("#B8860B")];} },
  'agg-put-dex': { label: 'Aggregate Put DEX', fields: ['agg_put_dex', 'one_agg_put_dex'], get colors(){return [themePaint("crimson"), themePaint("#3682f0"), themePaint("#8B0000"), themePaint("#1e4c8c")];} }
};
const COUNTERPART = { 'net-convexity': 'convexity-orderflow', 'net-gex': 'gex-orderflow', 'aggregate-dex': 'dex-orderflow', 'convexity-orderflow': 'net-convexity', 'gex-orderflow': 'net-gex', 'dex-orderflow': 'aggregate-dex' };
// Exact shipped light-theme default conversion, main UTF-16 394400+.
const LIGHT_COLORS = { get white(){return themePaint("#4b5563");},get lime(){return themePaint("#0f766e");},get yellow(){return themePaint("#a16207");},get cyan(){return themePaint("#0369a1");},get magenta(){return themePaint("#7e22ce");},get red(){return themePaint("#b91c1c");},get crimson(){return themePaint("#b91c1c");},get orange(){return themePaint("#b45309");},get '#00ff00'(){return themePaint("#15803d");},get '#ff0000'(){return themePaint("#b91c1c");},get '#006400'(){return themePaint("#166534");},get '#8b0000'(){return themePaint("#7f1d1d");},get '#00ffff'(){return themePaint("#0e7490");},get '#ae4ad5'(){return themePaint("#7e22ce");},get '#008b8b'(){return themePaint("#0f766e");},get '#800080'(){return themePaint("#6b21a8");},get '#2494cc'(){return themePaint("#0369a1");},get '#1a6d99'(){return themePaint("#0c4a6e");},get '#3682f0'(){return themePaint("#1d4ed8");},get '#1e4c8c'(){return themePaint("#1e3a8a");},get '#daa520'(){return themePaint("#a16207");},get '#b8860b'(){return themePaint("#92400e");},get '#228b22'(){return themePaint("#166534");},get '#fcb103'(){return themePaint("#a16207");} };
export function orderflowThemeColor(color, defaultColor, lightMode, customized = false) {
  const aliases={get white(){return themePaint("#ffffff");},get lime(){return themePaint("#00ff00");},get cyan(){return themePaint("#00ffff");},get red(){return themePaint("#ff0000");},get magenta(){return themePaint("#ff00ff");},get yellow(){return themePaint("#ffff00");},get orange(){return themePaint("#ffa500");}},normalize=value=>aliases[String(value).toLowerCase()]||String(value).toLowerCase();
  return lightMode && !customized && normalize(color)===normalize(defaultColor) ? LIGHT_COLORS[String(defaultColor).toLowerCase()] ?? LIGHT_COLORS[String(color).toLowerCase()] ?? color : color;
}

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const instrument = record => String(record.ticker ?? record.instrument ?? record.symbol ?? '').toUpperCase();
// Public REST timestamps are seconds; allow already-normalized milliseconds once.
export function orderflowTimestamp(value) {
  const number = finite(value);
  return number === null || number < 0 ? null : number < 1e11 ? number * 1000 : number;
}

export function collectOrderflowCandles(records = [], bucketMs = 60000, settings = {}) {
  if (!Number.isFinite(bucketMs) || bucketMs < 1000) return [];
  const multiplier = finite(settings.priceMultiplier) ?? 1, offset = finite(settings.priceOffset) ?? 0;
  const buckets = new Map();
  const points = records.map(record => ({ time: orderflowTimestamp(record.timestamp), price: finite(record.spot) })).filter(point => point.time !== null && point.price !== null && point.price !== 0).sort((a,b) => a.time-b.time);
  for (const point of points) {
    const time = Math.floor(point.time / bucketMs) * bucketMs, price = point.price * multiplier + offset;
    const candle = buckets.get(time);
    if (candle) { candle.high = Math.max(candle.high,price); candle.low = Math.min(candle.low,price); candle.close = price; candle.observations++; }
    else buckets.set(time,{time,open:price,high:price,low:price,close:price,observations:1});
  }
  return [...buckets.values()];
}

function bucketRecords(sorted, bucketMs) {
  const metricFields = new Map([...Object.values(ORDERFLOW_METRICS),...Object.values(DEX_CHILDREN)].flatMap(item => item.fields.map(field => [field,!!item.flow])));
  const buckets = new Map();
  for (const point of sorted) {
    const time = Math.floor(point.time/bucketMs)*bucketMs;
    let bucket = buckets.get(time);
    if (!bucket) { bucket={time,ticker:point.ticker,record:{},sums:new Map()}; buckets.set(time,bucket); }
    const previousSpot=finite(bucket.record.spot);
    bucket.record = {...bucket.record,...point.record,timestamp:time/1000};
    if(finite(point.record.spot)===null&&previousSpot!==null)bucket.record.spot=previousSpot;
    for (const [field] of metricFields) {
      const value = finite(point.record[field]); if(value===null)continue;
      const accumulator = bucket.sums.get(field) || {sum:0,count:0}; accumulator.sum+=value;accumulator.count++;bucket.sums.set(field,accumulator);
    }
    for(const item of Object.values(ORDERFLOW_METRICS).filter(item=>item.flow)){
      const zero=finite(point.record[item.fields[0]]),one=finite(point.record[item.fields[1]]);
      if(zero===null||one===null)continue;
      const key=`${item.fields[0]}:both`,accumulator=bucket.sums.get(key)||{sum:0,count:0};accumulator.sum+=zero+one;accumulator.count++;bucket.sums.set(key,accumulator);
    }
  }
  return [...buckets.values()].map(bucket => {
    for (const [field,isFlow] of metricFields) {
      const accumulator=bucket.sums.get(field);
      bucket.record[field]=accumulator ? isFlow ? accumulator.sum : accumulator.sum/accumulator.count : null;
    }
    bucket.record.combinedFlowBuckets={};
    for(const item of Object.values(ORDERFLOW_METRICS).filter(item=>item.flow))bucket.record.combinedFlowBuckets[item.fields[0]]=bucket.sums.get(`${item.fields[0]}:both`)?.sum??null;
    return bucket;
  });
}

export function makeOrderflowSeries(options = {}) {
  const { records = [], metric = 'net-convexity', expiry = 'zero', combine = false, settings = {} } = options;
  const descriptor = ORDERFLOW_METRICS[metric];
  if (!descriptor) throw new RangeError(`Unsupported Orderflow metric: ${metric}`);
  const selectedInstrument = options.ticker ? String(options.ticker).toUpperCase() : null;
  const byTimeAndInstrument = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const time = orderflowTimestamp(record.timestamp);
    const ticker = instrument(record);
    if (time === null || (selectedInstrument && ticker && ticker !== selectedInstrument)) continue;
    byTimeAndInstrument.set(`${ticker}:${time}`, { record, time, ticker });
  }
  let sorted = [...byTimeAndInstrument.values()].sort((a, b) => a.time - b.time);
  const instruments = [...new Set(sorted.map(point => point.ticker).filter(Boolean))];
  // Never silently stitch different instruments into a single apparent history.
  if (instruments.length > 1) return { metric, expiry, combine, label: descriptor.label, points: [], series: [], instruments, error: 'MIXED_INSTRUMENTS' };
  const actualRecords = sorted.map(point => point.record);
  const bucketMs = settings.spotViewMode === 'candles' ? Math.max(1000,finite(settings.candleBucketMs) ?? 60000) : Math.max(0,finite(settings.candleBucketMs) ?? 0);
  const priceMultiplier=finite(settings.priceMultiplier)??1,priceOffset=finite(settings.priceOffset)??0;
  const candles = Array.isArray(options.priceHistory)?options.priceHistory.map(c=>({...c,time:orderflowTimestamp(c.time??c.timestamp),open:c.open*priceMultiplier+priceOffset,high:c.high*priceMultiplier+priceOffset,low:c.low*priceMultiplier+priceOffset,close:c.close*priceMultiplier+priceOffset})).filter(c=>c.time!==null&&[c.open,c.high,c.low,c.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time):collectOrderflowCandles(actualRecords,bucketMs,settings);
  if(bucketMs>=1000)sorted=bucketRecords(sorted,bucketMs);
  const combined = !!combine && !descriptor.noCombine;
  const expiries = expiry === 'both' ? [0, 1] : [expiry === 'one' ? 1 : 0];
  const metricKeys = [metric, ...(combined ? [COUNTERPART[metric]] : [])];
  const definitions = [];
  for (const key of metricKeys) {
    const selected = ORDERFLOW_METRICS[key];
    if (selected.flow && expiry === 'both') definitions.push({ key, descriptor: selected, index: 0, summed: true });
    else for (const index of expiries) definitions.push({ key, descriptor: selected, index, summed: false });
    if (key === 'aggregate-dex') for (const child of Object.keys(DEX_CHILDREN)) for (const index of expiries) definitions.push({ key: child, descriptor: DEX_CHILDREN[child], index, summed: false });
  }
  const multiplier = finite(settings.priceMultiplier) ?? 1;
  const offset = finite(settings.priceOffset) ?? 0;
  const points = sorted.map(({ record, time, ticker }) => {
    const spot = finite(record.spot);
    return { time, ticker, record, spot: spot !== null && spot !== 0 ? spot * multiplier + offset : null, spotInterpolated: false };
  });
  // Only interpolate BETWEEN actual observations; no future/past extrapolation.
  let previous = -1;
  for (let index = 0; index < points.length; index++) if (points[index].spot !== null) {
    if (previous >= 0 && index > previous + 1) {
      const first = points[previous], last = points[index];
      for (let gap = previous + 1; gap < index; gap++) {
        const fraction = (points[gap].time - first.time) / (last.time - first.time);
        points[gap].spot = first.spot + fraction * (last.spot - first.spot);
        points[gap].spotInterpolated = true;
      }
    }
    previous = index;
  }
  const series = definitions.map(({ key, descriptor: item, index, summed }) => {
    const field = item.fields[index], fieldSettings = settings.series?.[field] || {};
    const primary = key === metric;
    const positiveDefault = item.colors[index * 2], negativeDefault = item.colors[index * 2 + 1];
    const positiveOverride = fieldSettings.color ?? (primary ? index === 1 ? settings.nextPositiveColor : settings.positiveColor : null);
    const negativeOverride = fieldSettings.negativeColor ?? (primary ? index === 1 ? settings.nextNegativeColor : settings.negativeColor : null);
    const positiveColor = orderflowThemeColor(positiveOverride ?? positiveDefault, positiveDefault, settings.lightMode, fieldSettings.isCustomized);
    const negativeColor = orderflowThemeColor(negativeOverride ?? negativeDefault, negativeDefault, settings.lightMode, fieldSettings.negativeIsCustomized);
    const thresholdKey = `${key.replace('-orderflow', '')} orderflow`;
    const threshold = item.flow ? Math.max(0, finite(options.thresholds?.[thresholdKey]) ?? finite(options.threshold) ?? 0) : 0;
    const showPositive = (fieldSettings.showPositive ?? (primary ? index === 1 ? settings.showNextPositive : settings.showPositive : undefined)) !== false;
    const showNegative = (fieldSettings.showNegative ?? (primary ? index === 1 ? settings.showNextNegative : settings.showNegative : undefined)) !== false;
    const values = points.map(point => {
      const rawZero = finite(point.record[item.fields[0]]), rawOne = finite(point.record[item.fields[1]]);
      const raw = summed ? point.record.combinedFlowBuckets ? finite(point.record.combinedFlowBuckets[item.fields[0]]) : rawZero !== null && rawOne !== null ? rawZero + rawOne : null : index === 0 ? rawZero : rawOne;
      const signEnabled = raw !== null && (raw >= 0 ? showPositive : showNegative);
      // A threshold masks the display only. Preserve raw even when zero/missing.
      return { time: point.time, raw, value: raw !== null && raw !== 0 && Math.abs(raw) >= threshold && signEnabled ? raw : null };
    });
    return { id: summed ? `${field}:both` : field, metric: key, expiry: summed ? 'both' : index === 0 ? 'zero' : 'one', label: `${item.label}${summed ? ' (0,1)' : index === 1 ? ' (Next)' : ''}`, field: summed ? item.fields.join(' + ') : field, flow: !!item.flow, threshold, positiveColor, negativeColor, showPositive, showNegative, values };
  });
  const levels = (Array.isArray(settings.majorLevels) ? settings.majorLevels : []).filter(definition=>definition.display!==false).map(definition => {
    let carried = null;
    const values = points.map(point => {
      if (own(point.record, definition.field)) {
        const current = finite(point.record[definition.field]);
        if (current !== null && current !== 0) carried = current * multiplier + offset;
      }
      const historical = ['zero_gamma', 'major_pos_vol', 'major_neg_vol'].includes(definition.field);
      return { time: point.time, value: historical ? bucketMs>=1000 ? null : carried : finite(point.record[definition.field]) ? finite(point.record[definition.field]) * multiplier + offset : null };
    });
    return { ...definition, values };
  });
  const pricePoints=Array.isArray(options.priceLine)?options.priceLine.map(point=>({time:orderflowTimestamp(point.time??point.timestamp),spot:finite(point.spot??point.close)})).filter(point=>point.time!==null&&point.spot!==null).map(point=>({...point,spot:point.spot*multiplier+offset})).sort((a,b)=>a.time-b.time):Array.isArray(options.priceHistory)?candles.map(candle=>({time:candle.time,spot:candle.close})):points;
  return { metric, expiry, combine: combined, label: descriptor.label, points, pricePoints, series, levels, candles, bucketMs, sourceObservationCount:actualRecords.length, instruments, error: null, flow: !!descriptor.flow };
}

function extent(values, includeZero = false) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return [-1, 1];
  let min = Infinity, max = -Infinity;
  for (const value of clean) { min = Math.min(min, value); max = Math.max(max, value); }
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  const padding = max>min ? (max-min)*.1 : Math.max(Math.abs(min)*.01,1);
  return [min - padding, max + padding];
}

function compact(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function orderflowPriceTicks(min,max,height){
  const ideal=(max-min)/Math.max(1,height/30),increments=[];
  for(let exponent=-8;exponent<=12;exponent++)for(const base of [1,2,2.5,5]){const value=base*10**exponent,tolerance=Math.max(1e-9,1e-9*Math.abs(value));if(value<1||Math.abs(value-Math.round(value))<=tolerance)increments.push(value);}
  const increment=increments.sort((a,b)=>a-b).find(value=>value>=ideal)||increments.at(-1)||1;
  const epsilon=1e-9*increment,first=Math.ceil((min-epsilon)/increment)*increment,last=Math.floor((max+epsilon)/increment)*increment;
  const decimals=Math.abs(increment-Math.round(increment))<=Math.max(1e-9,1e-9*Math.abs(increment))?0:2;
  const values=[];for(let index=0;index<Math.max(0,Math.floor((last-first)/increment+1+1e-9));index++)values.push(Number((first+index*increment).toPrecision(15)));
  return{increment,values,decimals};
}

function pathLine(ctx, points, x, y) {
  ctx.beginPath(); let connected = false;
  for (const point of points) {
    if (!Number.isFinite(point.value)) { connected = false; continue; }
    if (connected) ctx.lineTo(x(point.time), y(point.value)); else ctx.moveTo(x(point.time), y(point.value));
    connected = true;
  }
  ctx.stroke();
}

export function renderOrderflow(ctx, width, height, options = {}) {
  const data = makeOrderflowSeries(options);
  const settings = options.settings || {}, view = options.view || {};
  const axisColor = themeInk(false,settings.lightMode?'#353535':'#b9b9b9');
  const gridColor = settings.lightMode ? themePaint("#dddddd") : themePaint("#303030");
  const spotColor = orderflowThemeColor(settings.spotColor ?? themePaint("white"), themePaint("white"), settings.lightMode, settings.spotIsCustomized);
  const priceAxisVisible = options.showSpot !== false || (settings.showMajorLevels !== false && !!data.levels?.length);
  const left = Math.min(112,width*.25), right = Math.max(left + 1, width - (priceAxisVisible ? 75 : 18));
  const top = 30, bottom = Math.max(top + 1, height - 31);
  const first = data.pricePoints?.[0]?.time ?? data.points[0]?.time ?? Date.now() - 60000, last = data.pricePoints?.at(-1)?.time ?? data.points.at(-1)?.time ?? first + 60000;
  let startTime = finite(view.startTime) ?? first, endTime = finite(view.endTime) ?? last;
  if (endTime <= startTime) { startTime -= 30000; endTime += 30000; }
  const visible = data.points.filter(point => point.time >= startTime && point.time <= endTime);
  const visibleValues = data.series.flatMap(series => series.values.filter(point => point.time >= startTime && point.time <= endTime).map(point => point.value));
  const computed = extent(visibleValues);
  let minValue = finite(view.minValue) ?? computed[0], maxValue = finite(view.maxValue) ?? computed[1];
  if (maxValue <= minValue) { minValue -= 1; maxValue += 1; }
  const candleMode = settings.spotViewMode === 'candles';
  const visibleCandles = (data.candles || []).filter(candle => candle.time >= startTime && candle.time <= endTime);
  const visiblePrices=(data.pricePoints||data.points).filter(point=>point.time>=startTime&&point.time<=endTime);
  const spotDomain = extent([...(options.showSpot === false ? [] : candleMode ? visibleCandles.flatMap(candle=>[candle.low,candle.high]) : visiblePrices.map(point => point.spot)), ...(settings.showMajorLevels === false ? [] : (data.levels || []).flatMap(level => level.values.filter(point => point.time >= startTime && point.time <= endTime).map(point => point.value)))]);
  if(finite(view.minSpot)!==null&&finite(view.maxSpot)!==null&&view.maxSpot>view.minSpot){spotDomain[0]=view.minSpot;spotDomain[1]=view.maxSpot;}
  const timeX = time => left + (time - startTime) / (endTime - startTime) * (right - left);
  const valueY = value => bottom - (value - minValue) / (maxValue - minValue) * (bottom - top);
  const spotY = value => bottom - (value - spotDomain[0]) / (spotDomain[1] - spotDomain[0]) * (bottom - top);
  const xTime = x => startTime + (x - left) / (right - left) * (endTime - startTime);
  const externalPrices=Array.isArray(options.priceLine)||Array.isArray(options.priceHistory),hoverPrices=Array.isArray(options.priceLine)?data.pricePoints:Array.isArray(options.priceHistory)?data.candles.map(candle=>({time:candle.time,spot:candle.close})):[];
  const nearestIndex=(points,target)=>{if(!points.length)return -1;let low=0,high=points.length-1;while(low<high){const middle=Math.floor((low+high)/2);if(points[middle].time<target)low=middle+1;else high=middle;}if(low>0&&Math.abs(points[low-1].time-target)<=Math.abs(points[low].time-target))low--;return low;};
  const hitTest = position => {
    const target = typeof position === 'number' ? position : finite(position?.time) ?? xTime(position?.x ?? left);
    if(externalPrices){
      if(!Number.isFinite(target)||target<startTime||target>endTime)return null;
      const priceIndex=nearestIndex(hoverPrices,target);if(priceIndex<0)return null;const pricePoint=hoverPrices[priceIndex];
      const tolerance=Math.max(1000,data.bucketMs||60000),candidate=nearestIndex(data.points,pricePoint.time),metricIndex=candidate>=0&&Math.abs(data.points[candidate].time-pricePoint.time)<=tolerance?candidate:-1;
      let candleIndex=nearestIndex(data.candles,pricePoint.time);if(candleIndex>=0&&data.candles[candleIndex].time>pricePoint.time)candleIndex--;
      const candle=candleIndex>=0&&pricePoint.time<data.candles[candleIndex].time+tolerance?data.candles[candleIndex]:null;
      return {time:pricePoint.time,spot:pricePoint.spot,pricePoint,candle,index:metricIndex,record:metricIndex>=0?data.points[metricIndex].record:null,series:data.series.map(series=>({id:series.id,label:series.label,...(metricIndex>=0?series.values[metricIndex]:{time:pricePoint.time,raw:null,value:null})}))};
    }
    if (!data.points.length || target < startTime || target > endTime) return null;
    let low = 0, high = data.points.length - 1;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (data.points[middle].time < target) low = middle + 1; else high = middle; }
    if (low > 0 && Math.abs(data.points[low - 1].time - target) <= Math.abs(data.points[low].time - target)) low--;
    return { ...data.points[low], index: low, series: data.series.map(series => ({ id: series.id, label: series.label, ...series.values[low] })) };
  };
  ctx.save();
  ctx.fillStyle = settings.background || (settings.lightMode ? themePaint("#ffffff") : themePaint("#111111")); ctx.fillRect(0, 0, width, height);
  ctx.font = '12px Aleph, sans-serif, sans-serif'; ctx.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick++) {
    const fraction = tick / 4, y = bottom - fraction * (bottom - top);
    if (settings.showGrid !== false) { ctx.strokeStyle = gridColor;ctx.lineWidth=.2;ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1; }
    ctx.fillStyle = axisColor; ctx.textAlign = 'right'; ctx.fillText(compact(minValue + fraction * (maxValue - minValue)), left - 7, y + 4);
  }
  const priceTicks=orderflowPriceTicks(spotDomain[0],spotDomain[1],bottom-top);
  if(priceAxisVisible)for(const value of priceTicks.values){ctx.fillStyle=axisColor;ctx.textAlign='left';ctx.fillText(value.toFixed(priceTicks.decimals),right+7,spotY(value)+4);}
  const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: settings.timeZone || 'America/New_York' });
  for (let tick = 0; tick <= 4; tick++) { const time = startTime + tick / 4 * (endTime - startTime); ctx.fillStyle = axisColor; ctx.textAlign = 'center'; ctx.fillText(clock.format(new Date(time)), timeX(time), height - 9); }
  // A latest-only real observation is still useful. Label it rather than
  // making a missing session look blank or fabricating a flat history line.
  ctx.save();ctx.font='10px Aleph, sans-serif';ctx.textAlign='left';let legendX=left;
  for(const series of data.series.filter(series=>series.metric===data.metric)){
    const point=series.values.filter(point=>point.time>=startTime&&point.time<=endTime&&point.raw!==null).at(-1);
    if(!point||(point.raw>=0?!series.showPositive:!series.showNegative))continue;
    const label=`${series.expiry==='one'?'Next':series.expiry==='both'?'Combined':'Latest'} ${compact(point.raw)}`;
    ctx.fillStyle=point.raw>=0?series.positiveColor:series.negativeColor;ctx.fillText(label,legendX,top-10);legendX+=label.length*6+16;
  }ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip();
  ctx.strokeStyle = themePaint("#666666"); ctx.beginPath(); ctx.moveTo(left, valueY(0)); ctx.lineTo(right, valueY(0)); ctx.stroke();
  for (const series of data.series) {
    if (series.flow) {
      // Shipped uPlot renderer 783.de20bf0d.chunk.js UTF-16 27600+:
      // thin dashed vertical stems, not solid bars or filled areas.
      ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
      for (const point of series.values) if (point.value !== null && point.time >= startTime && point.time <= endTime) {
        ctx.strokeStyle = point.value >= 0 ? series.positiveColor : series.negativeColor;
        ctx.beginPath(); ctx.moveTo(timeX(point.time), valueY(0)); ctx.lineTo(timeX(point.time), valueY(point.value)); ctx.stroke();
      }
      ctx.setLineDash([]);
    } else {
      // Source signed exposure is a 2px line, with exact zero-crossing split.
      // It has NO area fill (783.de20bf0d.chunk.js UTF-16 29500+).
      ctx.lineWidth = 2; ctx.lineJoin = 'round';
      const segment = (first, last, positive) => {
        if(positive?!series.showPositive:!series.showNegative)return;
        ctx.strokeStyle = positive ? series.positiveColor : series.negativeColor;
        ctx.beginPath(); ctx.moveTo(timeX(first.time), valueY(first.value)); ctx.lineTo(timeX(last.time), valueY(last.value)); ctx.stroke();
      };
      for (let index = 1; index < series.values.length; index++) {
        const first = {...series.values[index - 1],value:series.values[index - 1].raw}, last = {...series.values[index],value:series.values[index].raw};
        if (first.value === null || last.value === null || first.value===0 || last.value===0) continue;
        if ((first.value >= 0) === (last.value >= 0)) segment(first, last, first.value >= 0);
        else {
          const crossing = { time: first.time + (last.time - first.time) * Math.abs(first.value) / (Math.abs(first.value) + Math.abs(last.value)), value: 0 };
          segment(first, crossing, first.value >= 0); segment(crossing, last, last.value >= 0);
        }
      }
    }
    const observed = series.values.filter(point => point.value !== null && point.time >= startTime && point.time <= endTime);
    if (!series.flow && observed.length === 1) {
      const point = observed[0]; ctx.fillStyle = point.value >= 0 ? series.positiveColor : series.negativeColor;
      ctx.beginPath(); ctx.arc(timeX(point.time), valueY(point.value), 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (settings.showMajorLevels !== false) for (const level of data.levels || []) {
    const dash=level.dash??({solid:[],'simple-dashed':[6,2],dashed:[8,4],dotted:[3,3]}[level.lineType]??[]);
    ctx.strokeStyle = orderflowThemeColor(level.color || themePaint("#999"), level.defaultColor || level.color || themePaint("#999"), settings.lightMode, level.isCustomized); ctx.lineWidth = level.lineWidth ?? level.size ?? 2; ctx.setLineDash(dash); pathLine(ctx, level.values, timeX, spotY);
  }
  ctx.setLineDash([]);
  if (options.showSpot !== false) {
    if(candleMode)for(let index=0;index<(data.candles||[]).length;index++){
      const candle=data.candles[index];if(candle.time<startTime||candle.time>endTime)continue;
      const x=timeX(candle.time),previous=index>0?timeX(data.candles[index-1].time):index<data.candles.length-1?2*x-timeX(data.candles[index+1].time):x-48,next=index<data.candles.length-1?timeX(data.candles[index+1].time):index>0?2*x-timeX(data.candles[index-1].time):x+48;
      const halfWidth=Math.min(12,Math.max(1.5,.38*Math.min(x-previous,next-x)));
      const metricPoint=data.series[0]?.values.find(point=>point.time===candle.time);
      const metricColor=metricPoint?.raw>=0?data.series[0]?.positiveColor:data.series[0]?.negativeColor;
      const up=candle.close>=candle.open;
      if((up?settings.candleUp:settings.candleDown)?.display===false)continue;
      const color=settings.candleColorMode==='metric'&&metricColor?metricColor:up?settings.candleUp?.color||themePaint("#0086E9"):settings.candleDown?.color||themePaint("#504B4B");
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,spotY(candle.high));ctx.lineTo(x,spotY(candle.low));ctx.stroke();ctx.fillStyle=color;ctx.fillRect(x-halfWidth,Math.min(spotY(candle.open),spotY(candle.close)),halfWidth*2,Math.max(1,Math.abs(spotY(candle.close)-spotY(candle.open))));
    }
    else {ctx.strokeStyle = spotColor; ctx.lineWidth = 1; pathLine(ctx, (data.pricePoints||data.points).map(point => ({ time: point.time, value: point.spot })), timeX, spotY);}
    const observed = visiblePrices.filter(point => point.spot !== null);
    if (!candleMode && observed.length === 1) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(timeX(observed[0].time), spotY(observed[0].spot), 2, 0, Math.PI * 2); ctx.fill(); }
  }
  const hovered = options.hover && settings.showCrosshairs !== false ? hitTest(options.hover) : null;
  if (hovered) { ctx.strokeStyle = settings.lightMode ? themePaint("#666666") : themePaint("#aaa"); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(timeX(hovered.time), top); ctx.lineTo(timeX(hovered.time), bottom);if(Number.isFinite(options.hover.y)){ctx.moveTo(left,options.hover.y);ctx.lineTo(right,options.hover.y);} ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  const hoverX=finite(options.hover?.x)??(hovered?timeX(hovered.time):null),hoverY=finite(options.hover?.y);
  if(options.hover&&settings.showAxisTooltips!==false&&hoverX!==null&&hoverY!==null&&hoverX>=left&&hoverX<=right&&hoverY>=top&&hoverY<=bottom){
    const badge=(text,x,y,align)=>{const w=text.length*7+10,h=22,start=align==='right'?x-w:align==='center'?x-w/2:x;ctx.fillStyle=settings.lightMode?themePaint("rgba(255,255,255,.95)"):themePaint("rgba(32,32,32,.95)");ctx.fillRect(start,y-h/2,w,h);ctx.fillStyle=settings.lightMode?themePaint("#1d1d1f"):themePaint("white");ctx.textAlign=align;ctx.font='12px Aleph, sans-serif';ctx.fillText(text,align==='left'?x+5:align==='right'?x-5:x,y+4);};
    badge((minValue+(bottom-hoverY)/(bottom-top)*(maxValue-minValue)).toFixed(2),left-2,hoverY,'right');
    if(priceAxisVisible)badge((spotDomain[0]+(bottom-hoverY)/(bottom-top)*(spotDomain[1]-spotDomain[0])).toFixed(2),right+2,hoverY,'left');
    badge(clock.format(new Date(xTime(hoverX))),hoverX,height-12,'center');
  }
  if (!data.points.length&&!visiblePrices.length) { ctx.textAlign = 'center'; ctx.fillStyle = settings.lightMode ? themePaint("#555555") : themePaint("#aaaaaa"); ctx.fillText(data.error === 'MIXED_INSTRUMENTS' ? 'Mixed instruments: choose one ticker' : 'No Orderflow observations available', (left + right) / 2, (top + bottom) / 2); }
  ctx.restore();
  return { left, right, top, bottom, startTime, endTime, minValue, maxValue, spotDomain, priceTicks, priceAxisVisible, timeX, xTime, valueY, spotY, hitTest, data };
}
