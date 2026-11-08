// Finite domains for numeric tool controls. Request values stay numeric strings.
export function numericControlChoices(id) {
  if(id==='lookback'||id==='maturity')return Array.from({length:365},(_,i)=>[String(i+1),`${i+1} ${i===0?'day':'days'}`]);
  if(id==='deltaMin'||id==='deltaMax')return Array.from({length:101},(_,i)=>[String(i/100),(i/100).toFixed(2)]);
  if(id==='strikePadding')return Array.from({length:101},(_,i)=>[String(i),`${i} strikes`]);
  return null;
}
