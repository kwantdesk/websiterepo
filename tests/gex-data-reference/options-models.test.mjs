import test from 'node:test';
import assert from 'node:assert/strict';
import { exchangeColor, exchangeGroup, exchangeLabel, marketShareModel, marketShareValue, marketShareTableModel, gainersModel, contractStatisticsRows, contractSideStatisticsRows, netDriftRows, flowStatisticsModel, MARKET_SHARE_COLUMNS, CONSOLIDATED_COLUMNS, OPTION_COLORS } from '../../public/gex-data-app/options-models.js';

test('exchange colors, grouping, aliases and source ordering do not depend on values', () => {
  assert.equal(exchangeGroup('NQEX'), 'NASDAQ'); assert.equal(exchangeColor('NQEX'), '#125ea4BB'); assert.equal(exchangeLabel('NQEX'), 'NOM');
  assert.equal(exchangeColor('SPHR'), '#b46b18CC'); assert.equal(exchangeGroup('NEW'), 'UNKNOWN'); assert.equal(exchangeColor('NEW'), 'gray');
  const data = { BATS: { equityCallVolume: 500 }, NQEX: { equityPutVolume: 1 }, AMEX: { equityCallVolume: 2 }, C2: { equityCallVolume: 3 } };
  const model = marketShareModel(data);
  assert.deepEqual(model.entries.map(row => row.exchange), ['AMEX', 'NQEX', 'C2', 'BATS']);
  assert.deepEqual(model.barRows.map(row => row.exchange), ['BATS', 'C2', 'NQEX', 'AMEX']);
  assert.equal(model.total, 506); assert.equal(model.xMax, 750);
  const grouped = marketShareModel(data, { view: 'EXCHANGE_GROUP' });
  assert.deepEqual(grouped.entries.map(row => [row.name, row.value]), [['CBOE', 503], ['NASDAQ', 1], ['NYSE', 2]]);
  assert.equal(grouped.entries[0].color, '#139853');
});

test('market share modes use equity call+put, index, or total and table has real rollups', () => {
  const data = { BATS: { equityCallVolume: 10, equityPutVolume: 20, indexVolume: 30, equityCallPremium: 5, equityPutPremium: 15, indexPremium: 80 }, C2: { equityCallVolume: 40 } };
  assert.equal(marketShareValue(data.BATS, 'EQUITY_VOLUME'), 30); assert.equal(marketShareValue(data.BATS, 'INDEX_PREMIUM'), 80); assert.equal(marketShareValue(data.BATS, 'TOTAL_PREMIUM'), 100);
  const table = marketShareTableModel(data); assert.equal(table.totalRow.totalVolume, 100); assert.equal(table.totalRow.equityTotalVolume, 70); assert.equal(table.rows[0].totalVolumePercentage, .6); assert.equal(table.totalRow.exchange, 'ALL');
  assert.equal(MARKET_SHARE_COLUMNS.length, 17); assert.equal(MARKET_SHARE_COLUMNS[2].key, 'equityCallVolume');
});

test('proportions preserve empty gray halves and use actual per-side metric', () => {
  const rows = contractStatisticsRows({ CALL: { premium: 60 }, PUT: { premium: 40 } });
  assert.equal(rows[0].leftFraction, .4); assert.equal(rows[0].rightFraction, .6); assert.equal(rows[0].leftColor, '#FF0000AA'); assert.equal(rows[0].rightColor, '#00FF00AA');
  assert.equal(rows[1].leftFraction, .5); assert.equal(rows[1].rightFraction, .5); assert.equal(rows[1].leftColor, OPTION_COLORS.emptyBar);
  const sides = contractSideStatisticsRows({ CALL: { ASK: { volume: 8 } }, PUT: { ASK: { volume: 2 } } }, 'VOLUME');
  assert.equal(sides.length, 5); assert.equal(sides[1].call, 8); assert.equal(sides[1].put, 2); assert.equal(sides[1].rightFraction, .8);
});

test('gainers rank and progress metadata use actual totals and zero-safe premium ratio', () => {
  const model = gainersModel({ AAA: { bullishPremium: 20, bearishPremium: 10, premium: 35, volume: 3, tradeCount: 1 }, BBB: { bullishPremium: 0, bearishPremium: 10, premium: 10, volume: 1, tradeCount: 1 } });
  assert.equal(model.rows[0].rank, 1); assert.equal(model.rows[0].premiumRatio, .5); assert.equal(model.rows[1].premiumRatio, 0); assert.equal(model.rows[0].volumePercentage, .75); assert.equal(model.maxBearishPremium, 10);
  assert.ok(CONSOLIDATED_COLUMNS.some(column => column.key === 'optionPrice'));
  assert.deepEqual(CONSOLIDATED_COLUMNS.slice(-14).map(column => column.key), ['delta', 'vega', 'theta', 'rho', 'omega', 'charm', 'gamma', 'vanna', 'veta', 'vomma', 'color', 'speed', 'ultima', 'zomma'].map(greek => `greeks.${greek}`));
});

test('net drift accumulates real premiums, signed volume and mid-market confidence widths', () => {
  const rows = netDriftRows({ 1: { stockPrice: 0, netCallPremium: 100 }, 2: { stockPrice: 100, netCallPremium: 20, netPutPremium: 10, netCallVolume: 5, netPutVolume: 2, midMarketCallPremium: 3, midMarketPutPremium: 4 }, 3: { netCallPremium: -5, netPutPremium: 2, netCallVolume: -1, midMarketCallPremium: 2, midMarketPutPremium: 1 } });
  assert.equal(rows.length, 2); assert.equal(rows[1].call, 15); assert.equal(rows[1].put, 12); assert.equal(rows[1].net, 3); assert.equal(rows[1].netVolume, 2); assert.equal(rows[1].callBand, 5); assert.equal(rows[1].putBand, 5); assert.equal(rows[1].spot, 100);
});

test('flow header sentiment excludes mid-market, ratio is call trade share and all totals include every side', () => {
  const statistics = {
    CALL: { ABOVE_ASK: { premium: 10, tradeCount: 2, volume: 4 }, ASK: { premium: 20, tradeCount: 3, volume: 6 }, MID_MARKET: { premium: 1000, tradeCount: 1, volume: 10 }, BID: { premium: 5, tradeCount: 1, volume: 2 }, BELOW_BID: { premium: 6, tradeCount: 1, volume: 3 } },
    PUT: { ABOVE_ASK: { premium: 7, tradeCount: 1, volume: 2 }, ASK: { premium: 8, tradeCount: 1, volume: 2 }, MID_MARKET: { premium: 2000, tradeCount: 1, volume: 2 }, BID: { premium: 40, tradeCount: 1, volume: 2 }, BELOW_BID: { premium: 50, tradeCount: 1, volume: 2 } }
  };
  const model = flowStatisticsModel(statistics);
  assert.equal(model.call.premium, 1041); assert.equal(model.put.premium, 2105); assert.equal(model.call.volume, 25); assert.equal(model.put.volume, 10);
  assert.equal(model.bullishPremium, 120); assert.equal(model.bearishPremium, 26); assert.equal(model.sentiment, 'BULLISH'); assert.equal(model.rings[0].label, 'Bullish');
  assert.equal(model.totalTradeCount, 13); assert.equal(model.callTradePercentage, 8 / 13 * 100); assert.equal(model.rings[1].percentage, 8 / 13 * 100);
  assert.equal(model.rings[2].put, 10); assert.equal(model.rings[2].call, 25); assert.equal(model.rings[3].put, 2105); assert.equal(model.rings[3].call, 1041);
  assert.equal(model.rings[0].segments[0].color, '#FF0000'); assert.equal(model.rings[0].segments[1].color, '#00FF00');
});

test('flow header neutral equality and empty totals use no invented sentiment thresholds', () => {
  const empty = flowStatisticsModel(); assert.equal(empty.sentiment, 'NEUTRAL'); assert.equal(empty.callTradePercentage, 0); assert.ok(empty.rings.every(ring => ring.segments.every(segment => segment.value === 0)));
  const equal = flowStatisticsModel({ CALL: { ASK: { premium: 1 }, BID: { premium: 1 } } }); assert.equal(equal.sentiment, 'NEUTRAL');
  const bearish = flowStatisticsModel({ PUT: { ASK: { premium: .01 } } }); assert.equal(bearish.sentiment, 'BEARISH'); assert.equal(bearish.rings[0].segments[0].value, 100);
});
