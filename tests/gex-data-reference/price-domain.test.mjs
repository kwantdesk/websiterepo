import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priceChartBounds} from '../../public/gex-data-app/equity-renderers.js';
import {niceValueDomain} from '../../public/gex-data-app/exposure-models.js';

test('line chart scales to plotted closes, candles retain genuine wick bounds',()=>{
  const rows=[{low:760,high:773,close:772.4},{low:759,high:765,close:760.1},{low:null,high:null,close:null}];
  assert.deepEqual(priceChartBounds(rows,'line'),{min:760.1,max:772.4});
  assert.deepEqual(priceChartBounds(rows,'candles'),{min:759,max:773});
  assert.equal(niceValueDomain(...Object.values(priceChartBounds(rows,'line'))).max,772.5);
  assert.equal(rows[0].high,773);
});
test('actual OHLC renderer uses chart-type-specific bounds for the visible window',()=>{
  const app=readFileSync(new URL('../../public/gex-data-app/app.js',import.meta.url),'utf8');
  const renderer=app.slice(app.indexOf('  function renderOhlcQuant('),app.indexOf('  function renderContractStatsQuant('));
  assert.match(renderer,/priceChartBounds\(visible,chartType\)/);
  assert.match(renderer,/niceValueDomain\(bounds.min,bounds.max\)/);
});
