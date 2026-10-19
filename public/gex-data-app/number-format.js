import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// market-data module 886167: public REST values are dollars, not internal cents.
export function abbreviate(value, decimalPlaces=2) {
  if(value==null||value===''||!Number.isFinite(Number(value)))return '—';
  const number=Number(value),absolute=Math.abs(number),entry=[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']].find(([divisor])=>absolute>=divisor),divisor=entry?.[0]||1;
  const scaled=number/divisor,factor=10**decimalPlaces,rounded=Math.round((scaled+Number.EPSILON)*factor)/factor;
  return (Number.isInteger(rounded)?String(rounded):rounded.toFixed(decimalPlaces))+(entry?' '+entry[1]:'');
}
export function currencyAbbreviated(value,decimalPlaces=0) {
  if(value==null||value===''||!Number.isFinite(Number(value)))return '—';
  const number=Number(value);return (number<0?'-':'')+'$'+abbreviate(Math.abs(number),decimalPlaces);
}
export function currencyAuto(value) {
  if(value==null||value===''||!Number.isFinite(Number(value)))return '—';
  const number=Number(value);return (number<0?'-':'')+'$'+Math.abs(number).toLocaleString('en-US',{minimumFractionDigits:Number.isInteger(number)?0:2,maximumFractionDigits:2});
}

// Axes omit insignificant zeroes; headline/table precision stays unchanged.
export function abbreviatedTick(value) {
  return abbreviate(value,2).replace(/(\.\d*?[1-9])0+(?= |$)/,'$1').replace(/\.0+(?= |$)/,'');
}
