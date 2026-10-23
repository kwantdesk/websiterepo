import assert from 'node:assert/strict';
import test from 'node:test';
import { createTableView } from '../../public/gex-data-app/table-view.js';

class Node {
  constructor(document) { this.ownerDocument = document; this.children = []; this.style = {}; this.dataset = {}; this.classList = { add() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  addEventListener() {}
  removeEventListener() {}
  querySelectorAll() { return []; }
}
function fixture(saved = null) {
  const document = { createElement: () => new Node(document), createTextNode: text => ({ textContent: text }) };
  const table = new Node(document); table.tBodies = [];
  table.createTHead = () => new Node(document); table.createTBody = () => new Node(document); table.createTFoot = () => new Node(document);
  let stored = saved;
  const view = createTableView({ table, storage: { getItem: () => stored && JSON.stringify(stored), setItem: (_, value) => { stored = JSON.parse(value); } } });
  return { view, saved: () => stored };
}
const full = ['date', 'time', 'ticker', 'price'].map(key => ({ key, label: key, type: 'text' }));
const latest = full.filter(column => column.key !== 'date');
const ids = view => view.getColumns().map(column => column.id);
const put = (view, columns) => view.setRows([{ date: 'Friday', time: 'now', ticker: 'QQQ', price: '12' }], { columns, toolId: 'equity-prints' });

test('rank-control changes apply new sort while same-control refresh preserves manual column sorting',()=>{
  const {view}=fixture();
  const rows=[{ticker:'AAA',bullish:10,bearish:30},{ticker:'BBB',bullish:20,bearish:5}];
  const columns=[{key:'ticker',type:'text'},{key:'bullish',type:'integer'},{key:'bearish',type:'integer'}];
  const refresh=sortKey=>view.setRows(rows,{columns,toolId:'gainers-losers',sortKey});
  refresh('bullish');assert.equal(view.getVisibleRows()[0].ticker,'BBB');
  refresh('bearish');assert.equal(view.getVisibleRows()[0].ticker,'AAA');
  view.setSort('ticker',-1);refresh('bearish');assert.equal(view.getVisibleRows()[0].ticker,'BBB');
  refresh('bullish');assert.equal(view.getVisibleRows()[0].ticker,'BBB');
  view.destroy();
});

test('Date appearing after latest tape joins its default first position', () => {
  const { view } = fixture();
  put(view, latest); put(view, full);
  assert.deepEqual(ids(view), ['date', 'time', 'ticker', 'price']);
  view.destroy();
});

test('new columns preserve existing custom relative order and filter state', () => {
  const { view } = fixture();
  put(view, latest); view.reorder('price', 'time'); view.setFilter('ticker', 'QQQ');
  put(view, full);
  assert.deepEqual(ids(view), ['price', 'date', 'time', 'ticker']);
  assert.equal(view.getVisibleRows().length, 1);
  put(view, latest); put(view, full);
  assert.deepEqual(ids(view), ['price', 'date', 'time', 'ticker']);
  view.setFilter('ticker', 'SPY'); assert.equal(view.getVisibleRows().length, 0);
  view.destroy();
});

test('temporarily absent Date restores saved custom position, width and hidden preference across reload', () => {
  const initial = { order: ['price', 'time', 'date', 'ticker'], widths: { date: 180, price: 150 }, hidden: ['date'] };
  const { view, saved } = fixture(initial);
  put(view, latest); view.setVisible('ticker', false);
  assert.deepEqual(saved().order, initial.order);
  put(view, full);
  assert.deepEqual(ids(view), initial.order);
  assert.equal(view.getColumns().find(column => column.id === 'date').width, 180);
  assert.equal(view.getColumns().find(column => column.id === 'date').visible, false);
  assert.equal(view.getColumns().find(column => column.id === 'ticker').visible, false);
  view.destroy();
});

test('unseen middle and trailing schema columns join default neighbours without resetting saved order', () => {
  const { view } = fixture({ order: ['time', 'price'], widths: { price: 173 } });
  put(view, full);
  assert.deepEqual(ids(view), ['date', 'time', 'ticker', 'price']);
  put(view, [...full, { key: 'venue', label: 'Venue' }]);
  assert.deepEqual(ids(view), ['date', 'time', 'ticker', 'price', 'venue']);
  assert.equal(view.getColumns().find(column => column.id === 'price').width, 173);
  view.destroy();
});
