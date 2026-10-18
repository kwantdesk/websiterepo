import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
import { normalizeAPIExpression } from './preferences-model.js?v=1';

// Inert source: 0nhy20zhludr9.js UTF-16 offsets 2200–14450 (modules
// 606332/72100). Public names/units: quantdata.us/api/docs/field-reference.
const EQ = ['EQUALS', 'DOES_NOT_EQUAL'];
const CMP = [...EQ, 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL_TO', 'LESS_THAN', 'LESS_THAN_OR_EQUAL_TO'];
const REL = CMP.slice(2);
export const FILTER_OPERATORS = Object.freeze([
  ['EQUALS', 'Equals (=)'], ['DOES_NOT_EQUAL', 'Does not equal (≠)'],
  ['GREATER_THAN', 'Greater than (>)'], ['GREATER_THAN_OR_EQUAL_TO', 'Greater than or equal (≥)'],
  ['LESS_THAN', 'Less than (<)'], ['LESS_THAN_OR_EQUAL_TO', 'Less than or equal (≤)'],
]);
const field = (api, label, kind = 'enum', extra = {}) => Object.freeze({
  api, label, kind, operators: ['number', 'integer', 'dollars', 'date'].includes(kind) ? CMP : EQ,
  defaultOperator: 'EQUALS', ...extra,
});
const OPTIONS = [
  field('ASK_PRICE', 'Ask Price', 'dollars'), field('BID_ASK_SPREAD', 'Bid-Ask Spread', 'dollars'),
  field('BID_PRICE', 'Bid Price', 'dollars'), field('CONTRACT_TYPE', 'Contract Type', 'enum', { choices: ['CALL', 'PUT'] }),
  field('EXCHANGE', 'Exchange'), field('EXCHANGE_GROUP', 'Exchange Group', 'enum', { unavailable: 'Present in source; public API field support not verified.' }),
  field('EXPIRATION_DATE', 'Expiration', 'date'),
  field('DTE', 'DTE (Days to Exp.)', 'number', { operators: REL, defaultOperator: 'GREATER_THAN_OR_EQUAL_TO' }),
  field('IMPLIED_VOLATILITY', 'Implied Volatility', 'number', { help: 'API raw IV units. No unverified percent conversion is applied.' }),
  field('INDUSTRY', 'Industry'),
  ...[['IS_CANCELLED','Cancelled Trades'],['IS_COMPLEX','Complex Trades'],['IS_ETF','ETFs'],['IS_FLOOR','Floor Trades'],['IS_INDEX','Indexes'],['IS_OPENING_POSITION','Opening Positions'],['IS_PRICE_IMPROVEMENT','Auctions'],['IS_TIED','Tied Trades'],['IS_UNUSUAL','Unusual Trades'],['IS_VOLUME_GREATER_THAN_OPEN_INTEREST','Volume > OI']].map(([api,label]) => field(api,label,'boolean')),
  field('MONEYNESS_IN_DOLLARS', 'Moneyness ($)', 'dollars', { defaultOperator: 'LESS_THAN_OR_EQUAL_TO' }),
  field('MONEYNESS_IN_PERCENT', 'Moneyness (%)', 'number', { help: 'Enter the API raw percentage value.' }),
  field('MONEY_TYPE', 'Money Type', 'enum', { choices: ['AT_THE_MONEY', 'IN_THE_MONEY', 'OUT_OF_THE_MONEY'] }),
  field('OPEN_INTEREST', 'Open Interest (OI)', 'integer'), field('OPTION_PRICE', 'Option Price', 'dollars'),
  field('PENNY_PROGRAM', 'Penny Program', 'boolean', { unavailable: 'Present in source; public API field support not verified.' }),
  field('PREMIUM', 'Premium', 'dollars', { defaultOperator: 'GREATER_THAN_OR_EQUAL_TO' }),
  field('SECTOR', 'Sector'), field('SENTIMENT', 'Sentiment', 'enum', { choices: ['BULLISH', 'BEARISH', 'NEUTRAL'] }),
  field('SIZE', 'Quantity', 'integer'), field('STOCK_PRICE', 'Stock Price', 'dollars'), field('STRIKE_PRICE', 'Strike Price', 'dollars'),
  field('TRADE_SIDE', 'Trade Side', 'enum', { choices: ['ABOVE_ASK', 'ASK', 'MID_MARKET', 'BID', 'BELOW_BID'] }),
  field('TRADE_TYPE', 'Trade Type'), field('VOLUME', 'Volume', 'integer'),
  ...['SIGMA','DELTA','VEGA','THETA','RHO','OMEGA','CHARM','GAMMA','VANNA','VETA','VOMMA','COLOR','SPEED','ULTIMA','ZOMMA'].map(api => field(api, api[0]+api.slice(1).toLowerCase(), 'number')),
  field('TICKER', 'Ticker', 'ticker'),
];
const CONSOLIDATED = [...OPTIONS,
  field('TRADE_CONSOLIDATION_TYPE', 'Trade Consolidation', 'enum', { choices: ['BLOCK','SPLIT','SWEEP'] }),
  field('IS_GOLDEN_SWEEP', 'Golden Sweeps', 'boolean'),
];
const EQUITIES = [
  field('TICKER','Ticker','ticker'), field('PRINT_TYPE','Trade Type','enum',{choices:['DARK_POOL','LIT_POOL']}),
  field('PRICE','Stock Price','dollars'), field('SIZE','Quantity','integer'),
  field('NOTIONAL_VALUE','Notional Value','dollars',{defaultOperator:'GREATER_THAN_OR_EQUAL_TO'}),
  field('ASK_PRICE','Ask Price','dollars'),field('ASK_SIZE','Ask Size','integer'),
  field('BID_PRICE','Bid Price','dollars'),field('BID_SIZE','Bid Size','integer'),
  field('TRADE_SIDE','Trade Side','enum',{choices:['ABOVE_ASK','ASK','MID_MARKET','BID','BELOW_BID']}),
  field('IS_DELAYED_PRINT','Phantom Prints','boolean'),
];
const NOTIFICATIONS = [field('TICKER','Ticker','ticker'),field('TYPE','Type')];
const OPTION_TOOLS = new Set(['contract-statistics','contract-trade-side-statistics','exposure-by-expiration','exposure-by-strike','gainers-losers','heat-map','iv-rank','market-share','market-share-table','net-drift','OPTION_TRADES_UNCONSOLIDATED']);
export function filterFieldsForTool(toolId) {
  if (!toolId || OPTION_TOOLS.has(toolId)) return [...OPTIONS];
  if (['order-flow-consolidated','OPTION_TRADES_CONSOLIDATED'].includes(toolId)) return [...CONSOLIDATED];
  if (['equity-prints','EQUITY_PRINTS_PROCESSED'].includes(toolId)) return [...EQUITIES];
  if (['exchange-notifications','EXCHANGE_NOTIFICATIONS'].includes(toolId)) return [...NOTIFICATIONS];
  return [];
}

const normalizedName = name => String(name).replace(/[^a-z0-9]/gi,'').toUpperCase();
const ALIASES = { SYMBOL:'TICKER', OPTIONTYPE:'CONTRACT_TYPE', EXPIRY:'EXPIRATION_DATE', EXPIRATION:'EXPIRATION_DATE', STRIKE:'STRIKE_PRICE', SPOT:'STOCK_PRICE', SPOTPRICE:'STOCK_PRICE', UNDERLYINGPRICE:'STOCK_PRICE', ASK:'ASK_PRICE', BID:'BID_PRICE', IV:'IMPLIED_VOLATILITY', OI:'OPEN_INTEREST', QUANTITY:'SIZE', MONEYNESSDOLLARS:'MONEYNESS_IN_DOLLARS', MONEYNESSPERCENT:'MONEYNESS_IN_PERCENT', MONEYNESSTYPE:'MONEY_TYPE', SENTIMENTTYPE:'SENTIMENT', TRADESENTIMENT:'SENTIMENT', SIDE:'TRADE_SIDE', TRADESIDECODE:'TRADE_SIDE', CONSOLIDATIONTYPE:'TRADE_CONSOLIDATION_TYPE', DAYSTOEXPIRATION:'DTE', NOTIONAL:'NOTIONAL_VALUE', EQUITYPRINTTYPE:'PRINT_TYPE' };
export function findFilterField(fields, input) {
  const key = normalizedName(input), alias = ALIASES[key];
  return fields.find(value => normalizedName(value.api) === key || value.api === alias);
}
export function createFilterDraft(fields) {
  const metadata = fields.find(value => !value.unavailable);
  return { field: metadata?.api || '', operation: metadata?.defaultOperator || 'EQUALS', text: '' };
}
export function expressionToDraft(expression, fields) {
  if (!expression) return { conjunction: 'OR', filters: [{ conjunction: 'AND', filters: [createFilterDraft(fields)] }] };
  if (Array.isArray(expression.filters)) return { conjunction: expression.conjunction || 'AND', filters: expression.filters.map(value => expressionToDraft(value, fields)) };
  const input = Object.hasOwn(expression,'values') ? expression.values : expression.value;
  let operation = expression.operation || 'EQUALS';
  try { operation = normalizeAPIExpression({field:'TICKER',operation,value:0}).operation; } catch { /* Preserve unsupported operations visibly; never translate Contains. */ }
  return { field: findFilterField(fields,expression.field)?.api || expression.field || '', operation, text: (Array.isArray(input) ? input : [input]).filter(value=>value!==undefined).map(String).join(', ') };
}
function parseValue(text, metadata) {
  const parts = String(text).split(',').map(value => value.trim());
  if (parts.some(value => value === '')) throw new TypeError(`${metadata.label}: enter a value; separate multiple values with commas.`);
  return parts.map(value => {
    if (['number','integer','dollars'].includes(metadata.kind)) {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new TypeError(`${metadata.label}: enter a number without currency symbols or thousands separators.`);
      const result = Number(value);
      if (!Number.isFinite(result) || metadata.kind === 'integer' && !Number.isInteger(result)) throw new TypeError(`${metadata.label}: enter a finite ${metadata.kind === 'integer' ? 'integer' : 'number'}.`);
      return result;
    }
    if (metadata.kind === 'boolean') {
      if (!['true','false'].includes(value)) throw new TypeError(`${metadata.label}: choose true or false.`);
      return value === 'true';
    }
    if (metadata.kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value)) throw new TypeError(`${metadata.label}: use a valid YYYY-MM-DD date.`);
    if (metadata.kind === 'ticker' && !/^[A-Z][A-Z0-9./-]{0,9}$/.test(value.toUpperCase())) throw new TypeError(`${metadata.label}: invalid ticker.`);
    return metadata.kind === 'ticker' ? value.toUpperCase() : value;
  });
}
export function draftToExpression(draft, fields) {
  const visit = node => {
    if (Array.isArray(node.filters)) return { conjunction: node.conjunction, filters: node.filters.map(visit) };
    const metadata = findFilterField(fields,node.field);
    if (!metadata) throw new TypeError(`Unsupported source field: ${node.field || '(none)'}.`);
    if (metadata.unavailable) throw new TypeError(`${metadata.label}: ${metadata.unavailable}`);
    const operation = normalizeAPIExpression({field:metadata.api,operation:node.operation,value:0}).operation;
    if (!metadata.operators.includes(operation)) throw new TypeError(`${metadata.label}: operator is not supported by the source field.`);
    return {field:metadata.api,operation,values:parseValue(node.text,metadata)};
  };
  return normalizeAPIExpression(visit(draft), {allowedFields:fields.filter(value=>!value.unavailable).map(value=>value.api)});
}
