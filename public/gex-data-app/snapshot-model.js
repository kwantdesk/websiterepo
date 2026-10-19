import {themePaint} from './site-theme.js?v=1';
import {gexStorage} from './site-runtime.js?v=1';
// Snapshot selectors are mutually exclusive per official market-data API docs.
// No generated market values or interpolation are performed here.
const NY='America/New_York';

// KES minute189 is labeled16:39Z but displays the completed16:40Z
// snapshot. Verified against QQQ2026-10-08: spot753.92, netGEX-3139382344.
export function completedMinuteSnapshot(time){
  if(!Number.isFinite(time))throw new Error('Invalid session minute');
  return time+60000;
}
const partsFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:NY,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});

function validateDate(date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid session date');
  return date;
}

function nyParts(time){return Object.fromEntries(partsFormatter.formatToParts(time).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));}

export function newYorkSessionDate(time){
  const epoch=typeof time==='number'?time:Date.parse(time);
  if(!Number.isFinite(epoch))throw new Error('Invalid snapshot time');
  const p=nyParts(epoch);return `${p.year}-${p.month}-${p.day}`;
}

export function sessionMinuteTimestamp(sessionDate,minuteIntoMarketOpen=0,{openMinute=570}={}){
  validateDate(sessionDate);
  if(!Number.isFinite(minuteIntoMarketOpen)||!Number.isFinite(openMinute))throw new Error('Invalid session minute');
  const [year,month,day]=sessionDate.split('-').map(Number),minute=openMinute+minuteIntoMarketOpen;
  const localTarget=Date.UTC(year,month-1,day,0,minute),target=new Date(localTarget);
  let epoch=localTarget;
  // Resolve this date's actual New York offset, including DST. Equity open is
  // not in a skipped/duplicated DST transition hour.
  for(let i=0;i<3;i++){
    const p=nyParts(epoch),represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    const delta=target.getTime()-represented;epoch+=delta;if(!delta)break;
  }
  return epoch;
}

export function sessionTimeline(sessionDate,{stepMinutes=1,openMinute=570,closeMinute=960}={}){
  validateDate(sessionDate);
  if(!Number.isInteger(stepMinutes)||stepMinutes<1||closeMinute<openMinute)throw new Error('Invalid session timeline');
  const length=Math.floor((closeMinute-openMinute)/stepMinutes)+1;
  return Array.from({length},(_,index)=>{const minute=index*stepMinutes,time=sessionMinuteTimestamp(sessionDate,minute,{openMinute});return {minute,time,snapshotTime:new Date(time).toISOString()};});
}

/** Resolve only source-proven ETF option schedules from the host's dated calendar. */
export function equityOptionSnapshotSchedule(ticker,sessionDate,calendar){
  if(typeof ticker!=='string'||!['SPY','QQQ','IWM'].includes(ticker.trim().toUpperCase()))return null;
  try{validateDate(sessionDate);}catch{return null;}
  const year=sessionDate.slice(0,4),holidays=calendar?.holidays?.[year],hours=calendar?.equityOptions;
  if(calendar?.version!==1||calendar.timeZone!==NY||!Array.isArray(calendar.verifiedYears)||!calendar.verifiedYears.includes(year)
    ||!Array.isArray(holidays)||!holidays.every(date=>typeof date==='string'&&/^\d{2}-\d{2}$/.test(date))
    ||!Array.isArray(calendar.earlyCloses)||!calendar.earlyCloses.every(date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date))
    ||!Array.isArray(hours?.symbols)||!hours.symbols.includes(ticker.trim().toUpperCase())
    ||hours.openMinute!==570||hours.closeMinute!==975||hours.earlyCloseMinute!==795)return null;
  const day=new Date(sessionDate+'T12:00:00Z').getUTCDay();
  if(day===0||day===6||holidays.includes(sessionDate.slice(5)))return null;
  return {verified:true,sessionDate,timeZone:NY,openMinute:hours.openMinute,
    closeMinute:calendar.earlyCloses.includes(sessionDate)?hours.earlyCloseMinute:hours.closeMinute};
}

/**
 * One-minute snapshot CONTROLS, never generated price/exposure observations.
 * The reference's terminal schedule boundary means latest/unpin, not a bucket
 * start to which another minute may be added. A dated, verified NY schedule is
 * required before adding that boundary; today's calendar cannot certify a
 * different historical date or another instrument's trading hours.
 * Missing source minutes stay missing. With no proven schedule retain the
 * actual source extent and its existing final-item latest behavior.
 */
export function snapshotControlTimeline(rows,{sessionDate,schedule=null,now=Date.now()}={}){
  validateDate(sessionDate);
  if(!Number.isFinite(now))throw new Error('Invalid current time');
  const verified=schedule?.verified===true&&schedule.sessionDate===sessionDate&&schedule.timeZone===NY;
  let open=-Infinity,close=Infinity;
  if(verified){
    const {openMinute,closeMinute}=schedule;
    if(!Number.isInteger(openMinute)||!Number.isInteger(closeMinute)||openMinute<0||openMinute>=1440||closeMinute<=openMinute||closeMinute>1440)throw new Error('Invalid snapshot session bounds');
    open=sessionMinuteTimestamp(sessionDate,0,{openMinute});
    close=sessionMinuteTimestamp(sessionDate,closeMinute-openMinute,{openMinute});
  }
  const times=[...new Set((rows||[]).map(row=>typeof row==='number'?row:Number(row?.time??row?.timestamp))
    .filter(time=>Number.isFinite(time)&&time%60000===0&&time<=now&&newYorkSessionDate(time)===sessionDate&&time>=open&&time<close))].sort((a,b)=>a-b);
  const entries=times.map(time=>({time,sourceTime:time,kind:'snapshot',snapshotTime:new Date(completedMinuteSnapshot(time)).toISOString()}));
  if(!entries.length)return entries;
  if(verified&&now>=close){
    // This is selectable calendar geometry only. No OHLC/exposure value is
    // attached, copied forward or claimed to be available at the close.
    entries.push({time:close,sourceTime:null,kind:'latest'});
  }else{
    const last=entries.at(-1);
    entries[entries.length-1]={time:last.time,sourceTime:last.sourceTime,kind:'latest'};
  }
  return entries;
}

export function snapshotRequest(base={},selection={}){
  const result={...base};delete result.sessionDate;delete result.snapshotTime;
  if(selection.sessionDate&&selection.snapshotTime)throw new Error('sessionDate and snapshotTime are mutually exclusive');
  if(selection.snapshotTime){const epoch=Date.parse(selection.snapshotTime);if(!Number.isFinite(epoch))throw new Error('Invalid snapshot time');result.snapshotTime=new Date(epoch).toISOString();}
  else if(selection.sessionDate)result.sessionDate=validateDate(selection.sessionDate);
  return result;
}

function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));return value;}
export function snapshotKey(endpoint,request){return `${endpoint}:${JSON.stringify(canonical(request))}`;}

export function selectedSnapshotSpot(rows,snapshotTime,{maxCarryMs=60000,sessionDate}={}){
  const selectedTime=typeof snapshotTime==='number'?snapshotTime:Date.parse(snapshotTime);
  if(!Number.isFinite(selectedTime))throw new Error('Invalid snapshot time');
  const selectedSession=sessionDate?validateDate(sessionDate):newYorkSessionDate(selectedTime);
  let candidate=null;
  for(const row of rows||[]){
    const time=Number(row.time??row.timestamp),raw=row.spot??row.close??row.closePrice??row.stockPrice;
    if(raw==null||!Number.isFinite(Number(raw))||!Number.isFinite(time)||time>selectedTime||selectedTime-time>maxCarryMs||newYorkSessionDate(time)!==selectedSession)continue;
    if(!candidate||time>candidate.time)candidate={time,spot:Number(raw)};
  }
  if(!candidate)return {available:false,selectedTime,sessionDate:selectedSession,reason:'No actual price at or within the permitted preceding interval'};
  return {available:true,selectedTime,sessionDate:selectedSession,sourceTime:candidate.time,spot:candidate.spot,match:candidate.time===selectedTime?'exact':'bounded-carry',ageMs:selectedTime-candidate.time};
}
