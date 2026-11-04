// Dark Flow source hook 829929, reference artifact 26k4mykzwgrj-.js:
// its first recorded timestamp selects the exchange-local cutoff regime.
// This is an initial viewport only; earlier recorded buckets remain available.
const NEW_YORK=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
const localClock=row=>{
  const value=row?.time;
  if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()!==''))return null;
  const time=Number(value);if(!Number.isFinite(time)||!Number.isFinite(new Date(time).getTime()))return null;
  const parts=Object.fromEntries(NEW_YORK.formatToParts(time).map(part=>[part.type,part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};
};

export function darkFlowInitialWindow(rows){
  if(!Array.isArray(rows)||!rows.length)return null;
  const first=localClock(rows[0]);if(!first)return null;
  // The shipped threshold is New York 2026-03-30 00:00, not UTC midnight,
  // today's date, the selected host timezone, or a fixed UTC offset.
  const cutoff=first.date>='2026-03-30'?4:8;
  const start=rows.findIndex(row=>{const clock=localClock(row);return clock!==null&&clock.hour>=cutoff;});
  return start<0?null:{start,end:rows.length-1};
}
