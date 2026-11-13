// Initial controls only: restore saved, copied and global selections afterwards.
// Audited reference defaults module 984770, SHA-256:
// 8a14cd7926b1681311ebbecf59cec8881677320871c350d90987fef33f62656e.
// An explicit unset/empty ticker is intentional; absence is not a SPY default.
const TICKER_DEFAULTS = Object.freeze({
  'dark-flow': 'SPY',
  'dark-pool-levels': 'SPY',
  'interval-map': 'SPY',
  'exposure-by-expiration': 'SPY',
  'exposure-by-strike': 'SPY',
  'heat-map': 'SPY',
  'iv-rank': 'SPY',
  'max-pain-over-time': 'SPY',
  'net-drift': 'SPY',
  'net-flow': 'SPY',
  'open-interest-by-expiration': 'SPY',
  'open-interest-by-strike': 'SPY',
  'open-interest-over-time': 'SPY',
  'term-structure': 'SPY',
  'volatility-drift': 'SPY',
  'volatility-skew': 'SPY',
  'stock-price-over-time': 'SPY',
  'option-price-over-time': '',
  'contract-statistics': '',
  'contract-trade-side-statistics': '',
  'max-pain': '',
  'equity-prints': '',
  'exchange-notifications': '',
  'news-articles': '',
  'market-share': '',
  'market-share-table': '',
  'open-interest-change': '',
  'order-flow-consolidated': '',
  'order-flow-unconsolidated': '',
});

export function toolControlDefault(toolId, controlId, fallback) {
  return controlId === 'ticker' && Object.hasOwn(TICKER_DEFAULTS, toolId)
    ? TICKER_DEFAULTS[toolId]
    : fallback;
}
