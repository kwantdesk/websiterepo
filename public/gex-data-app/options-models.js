import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// Source-backed presentation models, adapted to the licensed public REST schema.
// See OPTIONS-AUDIT.md for shipped source offsets and remaining parity limits.
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const OPTION_COLORS = Object.freeze({ get call(){return themePaint("#00FF00");}, get put(){return themePaint("#FF0000");}, get callBar(){return themePaint("#00FF00AA");}, get putBar(){return themePaint("#FF0000AA");}, get emptyBar(){return themePaint("#AAAAAAAA");} });
export const EXCHANGE_GROUP_COLORS = Object.freeze({ get BOX(){return themePaint("#9d2c2c");}, get CBOE(){return themePaint("#139853");}, get MEMX(){return themePaint("#b4ac18");}, get MIAX(){return themePaint("#b46b18");}, get NASDAQ(){return themePaint("#125ea4");}, get NYSE(){return themePaint("#711ac9");}, UNKNOWN: 'gray' });
export const EXCHANGE_GROUPS = Object.freeze({ AMEX: 'NYSE', BATS: 'CBOE', BOST: 'BOX', C2: 'CBOE', CBOE: 'CBOE', EDGX: 'CBOE', EMLD: 'MIAX', GEMI: 'NASDAQ', ISEX: 'NASDAQ', MEMX: 'MEMX', MIAX: 'MIAX', MRCY: 'NASDAQ', MX2: 'MEMX', NQBX: 'NASDAQ', NQEX: 'NASDAQ', PACF: 'NYSE', PERL: 'MIAX', PHIL: 'NASDAQ', SPHR: 'MIAX', UNKNOWN: 'UNKNOWN' });
const exchangeAlpha = { BOST: 'FF', BATS: 'FF', C2: 'EE', CBOE: 'DD', EDGX: 'CC', MEMX: 'FF', MX2: 'EE', EMLD: 'FF', MIAX: 'EE', PERL: 'DD', SPHR: 'CC', AMEX: 'FF', PACF: 'EE', GEMI: 'FF', ISEX: 'EE', MRCY: 'DD', NQBX: 'CC', NQEX: 'BB', PHIL: 'AA' };
export const EXCHANGE_LABELS = Object.freeze({ CBOE: 'CBOE', AMEX: 'AMEX', EDGX: 'EDGX', MIAX: 'MIAX', GEMI: 'GEMX', PACF: 'ARCA', BOST: 'BOX', ISEX: 'ISE', BATS: 'BZX', EMLD: 'EMLD', NQEX: 'NOM', PHIL: 'PHLX', NQBX: 'BX', PERL: 'PEARL', C2: 'C2', MRCY: 'MRX', MEMX: 'MEMX', SPHR: 'SPHR' });
export const exchangeGroup = exchange => EXCHANGE_GROUPS[exchange] || 'UNKNOWN';
export const exchangeLabel = exchange => EXCHANGE_LABELS[exchange] || exchange;
export const exchangeColor = exchange => EXCHANGE_GROUP_COLORS[exchangeGroup(exchange)] + (exchangeAlpha[exchange] || '');

export const MARKET_SHARE_MODES = Object.freeze([
  ['EQUITY_PREMIUM', 'Equity Premium'], ['INDEX_PREMIUM', 'Index Premium'], ['TOTAL_PREMIUM', 'Total Premium'],
  ['EQUITY_TRADE_COUNT', 'Equity Trade Count'], ['INDEX_TRADE_COUNT', 'Index Trade Count'], ['TOTAL_TRADE_COUNT', 'Total Trade Count'],
  ['EQUITY_VOLUME', 'Equity Volume'], ['INDEX_VOLUME', 'Index Volume'], ['TOTAL_VOLUME', 'Total Volume']
]);

export function marketShareValue(row, mode = 'EQUITY_VOLUME') {
  const metric = mode.endsWith('PREMIUM') ? 'Premium' : mode.endsWith('TRADE_COUNT') ? 'TradeCount' : 'Volume';
  const equity = numeric(row[`equityCall${metric}`]) + numeric(row[`equityPut${metric}`]);
  const index = numeric(row[`index${metric}`]);
  return mode.startsWith('EQUITY_') ? equity : mode.startsWith('INDEX_') ? index : equity + index;
}

export function marketShareModel(data = {}, { mode = 'EQUITY_VOLUME', view = 'EXCHANGE' } = {}) {
  let entries = Object.entries(data).filter(([key]) => key !== 'ALL').map(([exchange, row]) => ({ exchange, name: exchangeLabel(exchange), group: exchangeGroup(exchange), color: exchangeColor(exchange), value: marketShareValue(row, mode), row }));
  if (view === 'EXCHANGE_GROUP') {
    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.group)) groups.set(entry.group, { exchange: entry.group, name: entry.group, group: entry.group, color: EXCHANGE_GROUP_COLORS[entry.group], value: 0, members: [] });
      const group = groups.get(entry.group); group.value += entry.value; group.members.push(entry);
    }
    // Public REST object insertion order differs from the website's private
    // store. Preserve the observed website group order, not transport order.
    const groupOrder=['CBOE','NASDAQ','NYSE','UNKNOWN','MIAX','BOX','MEMX'];
    entries = [...groups.values()].sort((a,b)=>groupOrder.indexOf(a.group)-groupOrder.indexOf(b.group));
  } else entries.sort((a, b) => b.group.localeCompare(a.group) || b.exchange.localeCompare(a.exchange));
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  for (const entry of entries) entry.fraction = total === 0 ? 0 : entry.value / total;
  return { entries, barRows: [...entries].reverse(), total, xMax: 1.5 * Math.max(0, ...entries.map(entry => entry.value)), mode, view };
}

function proportion(label, call, put, money = false) {
  const total = call + put;
  return { label, category: label, call, put, total, money, leftFraction: total === 0 ? .5 : put / total, rightFraction: total === 0 ? .5 : call / total, leftColor: total === 0 || put === 0 ? OPTION_COLORS.emptyBar : OPTION_COLORS.putBar, rightColor: total === 0 || call === 0 ? OPTION_COLORS.emptyBar : OPTION_COLORS.callBar };
}
export function contractStatisticsRows(data = {}) {
  return [['Premium', 'premium', true], ['Volume', 'volume', false], ['Trade Count', 'tradeCount', false]].map(([label, metric, money]) => proportion(label, numeric(data.CALL?.[metric]), numeric(data.PUT?.[metric]), money));
}
export function contractSideStatisticsRows(data = {}, mode = 'PREMIUM') {
  const metric = mode === 'VOLUME' ? 'volume' : mode === 'TRADE_COUNT' ? 'tradeCount' : 'premium';
  return [['Above Ask', 'ABOVE_ASK'], ['Ask', 'ASK'], ['Mid Market', 'MID_MARKET'], ['Bid', 'BID'], ['Below Bid', 'BELOW_BID']].map(([label, side]) => proportion(label, numeric(data.CALL?.[side]?.[metric]), numeric(data.PUT?.[side]?.[metric]), metric === 'premium'));
}

export function netDriftRows(data = {}, { underlyingRequired = true } = {}) {
  let call = 0, put = 0, callVolume = 0, putVolume = 0, callBand = 0, putBand = 0, spot = 0;
  const rows = [];
  for (const [time, row] of Object.entries(data).filter(([key, value]) => /^\d+$/.test(key) && value && typeof value === 'object').sort(([a], [b]) => Number(a) - Number(b))) {
    const incomingSpot = numeric(row.stockPrice);
    if (!underlyingRequired || incomingSpot !== 0) spot = incomingSpot;
    // QD preprocesses zero/missing spot rows before accumulating the series.
    if (underlyingRequired && spot === 0) continue;
    call += numeric(row.netCallPremium); put += numeric(row.netPutPremium);
    callVolume += numeric(row.netCallVolume); putVolume += numeric(row.netPutVolume);
    callBand += numeric(row.midMarketCallPremium); putBand += numeric(row.midMarketPutPremium);
    rows.push({ time: Number(time), call, put, net: call - put, callVolume, putVolume, netVolume: callVolume - putVolume, callBand, putBand, spot: spot || NaN });
  }
  return rows;
}

// QDOptionsStatisticsRings, shipped module348139 (char1043854). Public REST
// amounts already use dollars; internal source uses cents but identical ratios.
export function flowStatisticsModel(statistics = {}) {
  const sum = contractType => Object.values(statistics[contractType] || {}).reduce((total, side) => ({ premium: total.premium + numeric(side?.premium), volume: total.volume + numeric(side?.volume), tradeCount: total.tradeCount + numeric(side?.tradeCount) }), { premium: 0, volume: 0, tradeCount: 0 });
  const call = sum('CALL'), put = sum('PUT');
  const premium = (contractType, side) => numeric(statistics[contractType]?.[side]?.premium);
  const bullishPremium = premium('CALL', 'ABOVE_ASK') + premium('CALL', 'ASK') + premium('PUT', 'BID') + premium('PUT', 'BELOW_BID');
  const bearishPremium = premium('CALL', 'BELOW_BID') + premium('CALL', 'BID') + premium('PUT', 'ASK') + premium('PUT', 'ABOVE_ASK');
  const sentiment = bullishPremium === bearishPremium ? 'NEUTRAL' : bullishPremium > bearishPremium ? 'BULLISH' : 'BEARISH';
  const sentimentLabel = { NEUTRAL: 'Neutral', BULLISH: 'Bullish', BEARISH: 'Bearish' }[sentiment];
  const percentage = (value, total) => total === 0 ? 0 : value / total * 100;
  const totalPremium = call.premium + put.premium, totalVolume = call.volume + put.volume, totalTradeCount = call.tradeCount + put.tradeCount, sentimentPremium = bullishPremium + bearishPremium;
  const callTradePercentage = percentage(call.tradeCount, totalTradeCount);
  const segments = (red, green) => [{ color: OPTION_COLORS.put, value: red }, { color: OPTION_COLORS.call, value: green }];
  return {
    call, put, totalPremium, totalVolume, totalTradeCount,
    bullishPremium, bearishPremium, sentimentPremium, sentiment, sentimentLabel,
    callTradePercentage,
    rings: [
      { id: 'sentiment', title: 'Sentiment', label: sentimentLabel, segments: segments(percentage(bearishPremium, sentimentPremium), percentage(bullishPremium, sentimentPremium)) },
      // The source displays the CALL share under this exact historical label.
      { id: 'ratio', title: 'Put / Call Ratio', percentage: callTradePercentage, segments: segments(percentage(put.tradeCount, totalTradeCount), callTradePercentage) },
      { id: 'volume', title: 'Put / Call Volume', put: put.volume, call: call.volume, segments: segments(percentage(put.volume, totalVolume), percentage(call.volume, totalVolume)) },
      { id: 'premium', title: 'Put / Call Premium', put: put.premium, call: call.premium, segments: segments(percentage(put.premium, totalPremium), percentage(call.premium, totalPremium)) }
    ]
  };
}

const column = (key, label, type = 'text', width = 120, extras = {}) => ({ key, label, type, width, ...extras });
export const GAINERS_COLUMNS = Object.freeze([
  column('rank', 'Rank', 'integer', 70, { sortable: false }), column('ticker', 'Ticker', 'text', 90),
  column('bearishPremium', 'Bearish Premium', 'money', 150, { bar: 'negative', maxField: 'maxBearishPremium' }),
  column('bullishPremium', 'Bullish Premium', 'money', 150, { bar: 'positive', maxField: 'maxBullishPremium' }),
  column('premiumRatio', 'Premium Ratio', 'decimal', 130), column('volume', 'Volume', 'abbreviated', 140, { percentField: 'volumePercentage' }),
  column('tradeCount', 'Trade Count', 'abbreviated', 140, { percentField: 'tradeCountPercentage' }), column('premium', 'Premium', 'money', 140, { percentField: 'premiumPercentage' })
]);
export const MARKET_SHARE_COLUMNS = Object.freeze([
  column('group', 'Group','text',120,{blankUnknown:true}), column('exchange', 'Exchange'),
  ...['Volume', 'TradeCount', 'Premium'].flatMap(metric => {
    const label = metric === 'TradeCount' ? 'Trade Count' : metric;
    const type = metric === 'Premium' ? 'money' : 'integer';
    return [column(`equityCall${metric}`, `Call ${label}`, type,120,{rawMoney:metric==='Premium'}), column(`equityPut${metric}`, `Put ${label}`, type,120,{rawMoney:metric==='Premium'}),
      ...['equity', 'index', 'total'].map(bucket => column(bucket === 'total' ? `total${metric}` : `${bucket}Total${metric}`, `${bucket[0].toUpperCase() + bucket.slice(1)} ${label}`, type, 160, { rawMoney:metric==='Premium',percentField: `${bucket}${metric}Percentage` }))];
  })
]);
export const CONSOLIDATED_COLUMNS = Object.freeze([
  column('tradeTime', 'Date', 'date', 120, { id: 'date' }), column('tradeTime', 'Time', 'time', 140, { id: 'time', canHide: false, fractionalSecondDigits: 3 }),
  column('contract', 'Contract', 'contract', 280, { sortKeys: ['ticker', 'expirationDate', 'strikePrice', 'contractType'] }),
  column('stockPrice', 'Spot', 'money', 100), column('size', 'Quantity', 'integer', 110),
  column('optionPrice', 'Price', 'priceSide', 120), column('bidAskSpread', 'Bid-Ask', 'bidAsk', 160), column('premium', 'Premium', 'money', 130),
  column('sentimentType', 'Sentiment', 'sentiment', 130), column('exchange', 'Exchange', 'text', 130, {rawExchange:true}), column('tradeType', 'Type', 'text', 190),
  column('tradeConsolidationType', 'Consolidation', 'text', 150), column('moneyness', 'Moneyness', 'moneyness', 220),
  column('volume', 'Volume', 'integer', 120), column('openInterest', 'OI', 'integer', 90), column('impliedVolatility', 'IV', 'percentagePoints', 90),
  column('dte', 'DTE', 'decimal', 100), column('sector', 'Sector', 'enum', 160), column('industry', 'Industry', 'enum', 180),
  ...['delta', 'vega', 'theta', 'rho', 'omega', 'charm', 'gamma', 'vanna', 'veta', 'vomma', 'color', 'speed', 'ultima', 'zomma'].map(greek => column(`greeks.${greek}`, greek[0].toUpperCase() + greek.slice(1), 'greek', ['omega', 'gamma', 'vomma', 'zomma'].includes(greek) ? 120 : ['rho', 'veta'].includes(greek) ? 100 : 110))
]);

export function gainersModel(data = {}, sortKey = 'bullishPremium', direction = -1) {
  const rows = Object.entries(data).map(([ticker, row]) => ({ ticker, ...row, premiumRatio: numeric(row.bullishPremium) === 0 ? 0 : numeric(row.bearishPremium) / numeric(row.bullishPremium) }));
  const totals = { premium: 0, tradeCount: 0, volume: 0 };
  for (const row of rows) for (const key of Object.keys(totals)) totals[key] += numeric(row[key]);
  const maxBullishPremium = Math.max(0, ...rows.map(row => numeric(row.bullishPremium))), maxBearishPremium = Math.max(0, ...rows.map(row => numeric(row.bearishPremium)));
  rows.sort((a, b) => (typeof a[sortKey] === 'number' && typeof b[sortKey] === 'number' ? a[sortKey] - b[sortKey] : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''))) * direction);
  rows.forEach((row, index) => { row.rank = index + 1; row.maxBullishPremium = maxBullishPremium; row.maxBearishPremium = maxBearishPremium; for (const key of Object.keys(totals)) row[`${key}Percentage`] = totals[key] === 0 ? 0 : numeric(row[key]) / totals[key]; });
  return { rows, totals, maxBullishPremium, maxBearishPremium };
}

export function marketShareTableModel(data = {}) {
  const totals = Object.fromEntries(['Volume', 'TradeCount', 'Premium'].flatMap(metric => ['equity', 'index', 'total'].map(bucket => [`${bucket}${metric}`, 0])));
  const rows = Object.entries(data).filter(([exchange]) => exchange !== 'ALL').map(([exchange, row]) => {
    const result = { exchange, exchangeLabel: exchangeLabel(exchange), group: exchangeGroup(exchange), color: exchangeColor(exchange), ...row };
    for (const metric of ['Volume', 'TradeCount', 'Premium']) {
      result[`equityTotal${metric}`] = numeric(row[`equityCall${metric}`]) + numeric(row[`equityPut${metric}`]);
      result[`indexTotal${metric}`] = numeric(row[`index${metric}`]);
      result[`total${metric}`] = result[`equityTotal${metric}`] + result[`indexTotal${metric}`];
      for (const bucket of ['equity', 'index', 'total']) totals[`${bucket}${metric}`] += result[bucket === 'total' ? `total${metric}` : `${bucket}Total${metric}`];
    }
    return result;
  });
  const totalRow = { exchange: 'ALL', exchangeLabel: 'ALL', group: 'TOTAL' };
  for (const metric of ['Volume', 'TradeCount', 'Premium']) {
    totalRow[`equityCall${metric}`] = rows.reduce((sum, row) => sum + numeric(row[`equityCall${metric}`]), 0);
    totalRow[`equityPut${metric}`] = rows.reduce((sum, row) => sum + numeric(row[`equityPut${metric}`]), 0);
    for (const bucket of ['equity', 'index', 'total']) {
      const field = bucket === 'total' ? `total${metric}` : `${bucket}Total${metric}`, total = totals[`${bucket}${metric}`];
      totalRow[field] = total; totalRow[`${bucket}${metric}Percentage`] = 1;
      for (const row of rows) row[`${bucket}${metric}Percentage`] = total === 0 ? 0 : row[field] / total;
    }
  }
  return { rows, totalRow, totals };
}

// These canvas helpers reproduce the source layout rules, without running the
// downloaded bundle. Return hit regions so the caller can add real tooltips.
export function drawProportionChart(ctx, width, height, rows, { formatValue = (value, row) => String(value), formatPercent = value => `${(value * 100).toFixed(1)}%`, fontSize = 13, primary = themePaint("#7D1AD6"), grid = themePaint("#FFFFFF33") } = {}) {
  ctx.font = `bold ${fontSize}px Aleph, sans-serif`;
  const left = Math.ceil(Math.max(0, ...rows.map(row => ctx.measureText(row.label).width))) + 16, right = width - 16, top = 8, bottom = height - 20, band = (bottom - top) / Math.max(rows.length, 1), barHeight = .6 * band, x = value => left + value / 1.01 * (right - left);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const value of [0, .25, .5, .75, 1]) { ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(value), top); ctx.lineTo(x(value), bottom); ctx.stroke(); ctx.fillStyle = themePaint("#FFFFFF"); ctx.fillText(`${value*100}%`, x(value), bottom + 6); }
  ctx.strokeStyle = primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
  const hits = [];
  rows.forEach((row, index) => {
    const center = top + (index + .5) * band, split = x(row.leftFraction), end = x(row.leftFraction + row.rightFraction);
    ctx.fillStyle = themePaint("#FFFFFF"); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(row.label, left - 8, center);
    ctx.fillStyle = row.leftColor; ctx.fillRect(left, center - barHeight / 2, split - left, barHeight);
    ctx.fillStyle = row.rightColor; ctx.fillRect(split, center - barHeight / 2, end - split, barHeight);
    const putFraction = row.total === 0 ? 0 : row.put / row.total, callFraction = row.total === 0 ? 0 : row.call / row.total;
    ctx.fillStyle = themePaint("#FFFFFF"); ctx.textAlign = 'left'; ctx.fillText(`${formatValue(row.put, row)} (${formatPercent(putFraction)})`, left + 11, center);
    ctx.textAlign = 'right'; ctx.fillText(`${formatValue(row.call, row)} (${formatPercent(callFraction)})`, end - 11, center);
    hits.push({ index, x: left, y: top + index * band, width: right - left, height: band });
  });
  return hits;
}

export function layoutMarketSharePieLabels(labels, width, height, preferredRadius, { padding = 4, gap = 2 } = {}) {
  const centerX = width / 2, centerY = height / 2;
  const halfHeight = Math.max(0, ...labels.map(label => label.halfHeight));
  const capacity = Math.max(1, Math.floor((height - 2 * padding + gap) / Math.max(1, 2 * halfHeight + gap)));
  const sides = { left: [], right: [] };
  for (const label of labels) sides[Math.cos(label.midAngle) >= 0 ? 'right' : 'left'].push({ ...label });
  // Small adjacent sectors can all land on one side of the vertical tangent.
  // Move only overflowing labels nearest that tangent; their leaders continue
  // to originate at the true slice angle. Slice geometry is never redistributed.
  for (const side of ['left', 'right']) {
    const other = side === 'left' ? 'right' : 'left';
    while (sides[side].length > capacity && sides[other].length < capacity) {
      let nearest = 0;
      for (let index = 1; index < sides[side].length; index++) if (Math.abs(Math.cos(sides[side][index].midAngle)) < Math.abs(Math.cos(sides[side][nearest].midAngle))) nearest = index;
      sides[other].push(sides[side].splice(nearest, 1)[0]);
    }
  }
  const maximumWidth = Math.max(0, ...labels.map(label => label.textWidth));
  const radius = Math.max(1, Math.min(preferredRadius, width / 2 - maximumWidth - padding - 20));
  const result = [];
  for (const [side, list] of Object.entries(sides)) {
    const direction = side === 'right' ? 1 : -1;
    list.sort((a, b) => Math.sin(a.midAngle) - Math.sin(b.midAngle) || a.midAngle - b.midAngle);
    for (let index = 0; index < list.length; index++) {
      const label = list[index], ideal = centerY + Math.sin(label.midAngle) * (radius + 10);
      const previous = list[index - 1];
      label.y = Math.max(padding + label.halfHeight, ideal, previous ? previous.y + previous.halfHeight + label.halfHeight + gap : -Infinity);
    }
    for (let index = list.length - 1; index >= 0; index--) {
      const label = list[index], next = list[index + 1];
      label.y = Math.min(height - padding - label.halfHeight, label.y, next ? next.y - next.halfHeight - label.halfHeight - gap : Infinity);
      const textX = direction > 0 ? Math.min(width - padding - label.textWidth, centerX + radius + 20) : Math.max(padding + label.textWidth, centerX - radius - 20);
      result.push({ ...label, direction, textX, bounds: { left: direction > 0 ? textX : textX - label.textWidth, right: direction > 0 ? textX + label.textWidth : textX, top: label.y - label.halfHeight, bottom: label.y + label.halfHeight } });
    }
  }
  return { radius, labels: result };
}

export function drawMarketSharePie(ctx, width, height, entries, { fontSize = 13, formatPercent = value => `${(value * 100).toFixed(1)}%` } = {}) {
  const centerX = width / 2, centerY = height / 2, preferredRadius = Math.min(width, height) / 2 * .62, lineHeight = fontSize + 2, total = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);
  let radius = preferredRadius;
  if (total <= 0) return { centerX, centerY, radius, cumulativeAngles: [] };
  ctx.font = `bold ${fontSize}px Aleph, sans-serif`; ctx.lineWidth = 1;
  const labels = [], cumulativeAngles = []; let fraction = 0;
  entries.forEach(entry => {
    const share = Math.max(0, entry.value) / total, start = fraction * Math.PI * 2 - Math.PI / 2; fraction += share; const end = fraction * Math.PI * 2 - Math.PI / 2; cumulativeAngles.push(fraction);
    if (share <= 0) return;
    const lines = [entry.name, formatPercent(share)], angle = (start + end) / 2;
    labels.push({ start, end, midAngle: angle, color: entry.color, lines, halfHeight: (lineHeight + fontSize) / 2, textWidth: Math.max(...lines.map(line => ctx.measureText(line).width)) });
  });
  const layout = layoutMarketSharePieLabels(labels, width, height, preferredRadius);
  radius = layout.radius;
  for (const label of labels) {
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, label.start, label.end); ctx.closePath(); ctx.fillStyle = label.color; ctx.fill();
  }
  for (const label of layout.labels) {
    const { y, direction, textX } = label, elbowX = textX - 4 * direction;
    ctx.strokeStyle = label.color; ctx.beginPath(); ctx.moveTo(centerX + Math.cos(label.midAngle) * radius, centerY + Math.sin(label.midAngle) * radius); ctx.lineTo(elbowX - 8 * direction, y); ctx.lineTo(elbowX, y); ctx.stroke(); ctx.fillStyle = label.color; ctx.textAlign = direction === 1 ? 'left' : 'right'; ctx.textBaseline = 'middle';
    label.lines.forEach((line, index) => ctx.fillText(line, textX, y + (index - .5) * lineHeight));
  }
  return { centerX, centerY, radius, cumulativeAngles, labels: layout.labels };
}

export function drawMarketShareBars(ctx, width, height, model, { formatValue = String, formatPercent = value => `${(value * 100).toFixed(1)}%`, fontSize = 13, primary = themePaint("#7D1AD6"), grid = themePaint("#FFFFFF33"), ticks = null } = {}) {
  const rows = model.barRows; ctx.font = `bold ${fontSize}px Aleph, sans-serif`;
  const left = Math.ceil(Math.max(0, ...rows.map(row => ctx.measureText(row.name).width))) + 16, right = width - 16, top = 8, bottom = height - 20, band = (bottom - top) / Math.max(1, rows.length), barHeight = .6 * band, xMax = Math.max(model.xMax, 1e-9), x = value => left + value / xMax * (right - left);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const value of ticks || [0, .25, .5, .75, 1].map(fraction => fraction * xMax)) { ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(value), top); ctx.lineTo(x(value), bottom); ctx.stroke(); ctx.fillStyle = themePaint("#FFFFFF"); ctx.fillText(formatValue(value), x(value), bottom + 6); }
  ctx.strokeStyle = primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
  return rows.map((row, index) => { const y = top + (index + .5) * band, end = x(Math.max(0, row.value)); ctx.fillStyle = themePaint("#FFFFFF"); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(row.name, left - 8, y); ctx.fillStyle = row.color; ctx.fillRect(left, y - barHeight / 2, end - left, barHeight); ctx.fillStyle = themePaint("#FFFFFF"); ctx.textAlign = 'left'; ctx.fillText(`${formatValue(row.value)} (${formatPercent(row.fraction)})`, end + 6, y); return { index, x: left, y: top + index * band, width: right - left, height: band }; });
}
