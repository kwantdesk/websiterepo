export const CBOE_CALENDAR_URL = 'https://www.cboe.com/about/hours/us-options/';
export const CALENDAR_CHECK_MS = 6 * 60 * 60 * 1000;
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const EXPIRATION_TYPES = {
  standard: {label:'Standard options expiry',short:'Monthly',products:['Equity','ETF / ETN','Equity index'],description:'Standard monthly expiration for equity, equity index, ETF and ETN options. Settlement style and the last trading session depend on the actual contract; an AM-settled index contract stops trading before its settlement date.'},
  'am-last-trade': {label:'AM index · last trading day',short:'AM last trade',products:['Equity index'],description:'Last trading day marked by Cboe for expiring standard AM-settled equity index options. This is not the settlement date. Check the actual series and broker cutoff.'},
  'vix-last-trade': {label:'VIX · last trading day',short:'VIX last trade',products:['VIX'],description:'Last day to trade the expiring standard VIX options marked on the calendar. VIX expiry/settlement is a separate event; weekly series also have their own last trading day.'},
  'vix-standard': {label:'VIX standard expiry',short:'VIX monthly',products:['VIX'],description:'Standard VIX options expiration/settlement date. This is not the final trading day. The date can move because of an exchange holiday.'},
  'vix-exception': {label:'VIX holiday exception',short:'VIX shift',products:['VIX'],description:'Cboe marks an exception to the usual VIX schedule. A holiday on the relevant Wednesday or the Friday 30 days later can bring the expiration forward to Tuesday. Use the date shown, not an every-Wednesday assumption.'},
  'vix-weekly': {label:'VIX weekly expiry',short:'VIX weekly',products:['VIX'],description:'VIX Weeklys expiration/settlement date marked by Cboe. The last trading day is normally the preceding business day, not this expiry date. Holiday exceptions may apply.'},
  'spx-weekly': {label:'SPX / XSP weekly expiry',short:'SPX / XSP',products:['SPX / XSP'],description:'SPX and XSP Weeklys expiration marked by Cboe. The PDF excludes dates coinciding with the third-Friday, end-of-month and quarterly index expirations. This does not mean every stock or ETF has a daily-expiring contract.'},
  'month-end': {label:'End-of-month expiry',short:'Month end',products:['Equity index'],description:'End-of-month options expire at the close. On March, June, September and December dates, the same colour also marks end-of-quarter options.'},
  'quarter-end': {label:'End-of-quarter expiry',short:'Quarter end',products:['Equity index'],description:'End-of-quarter options expire at the close in March, June, September and December. Cboe uses the same purple colour for month-end and quarter-end events.'},
  holiday: {label:'Exchange holiday',short:'Holiday',products:['All'],description:'Cboe exchange holiday for regular options trading. A holiday marker is not a statement that every global/overnight session is closed; consult Cboe’s hours and holidays schedule.'},
  leaps: {label:'Equity / ETP LEAPS added',short:'LEAPS added',products:['Equity','ETF / ETN'],description:'New long-dated equity and ETP LEAPS series are added. This is a listing event, not the day those new contracts expire.'},
} as const;
export type ExpirationType = keyof typeof EXPIRATION_TYPES;
export type CalendarDay = {date:string;types:ExpirationType[]};
export type ExpirationCalendar = {
  year:number;days:CalendarDay[];colors:Record<ExpirationType,string>;leapsYear:number;
  source:{url:string;sha256:string;retrievedAt:string;lastModified:string|null;etag:string|null};
};
export type ExpirationCalendarResponse = {calendar:ExpirationCalendar|null;availableYears:number[];checkedAt:string;nextCheckAt:string;status:'current'|'stale'|'unavailable';message:string|null};
export function exchangeDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function dateLabel(date:string){return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(date+'T12:00:00Z'));}
/** Compare exchange calendar dates, never the browser's local midnight. */
export function calendarDateState(date:string,today:string,selected:string){return {past:date<today,today:date===today,selected:date===selected};}
export function visibleCalendarTypes(day:CalendarDay,types:ExpirationType[],product:string,search:string){
  return day.types.filter(type=>types.includes(type)&&(product==='All'||(EXPIRATION_TYPES[type].products as readonly string[]).includes(product)||(product==='SPX / XSP'&&(EXPIRATION_TYPES[type].products as readonly string[]).includes('Equity index'))||(product==='Equity index'&&type==='spx-weekly')||type==='holiday')&&(!search||`${day.date} ${dateLabel(day.date)} ${EXPIRATION_TYPES[type].label} ${EXPIRATION_TYPES[type].short} ${EXPIRATION_TYPES[type].products.join(' ')}`.toLowerCase().includes(search.toLowerCase())));
}
export function matchesCalendarDay(day:CalendarDay,types:ExpirationType[],product:string,search:string){return visibleCalendarTypes(day,types,product,search).length>0;}
export function calendarMonthCells(year:number,month:number){
  const first=new Date(Date.UTC(year,month,1)).getUTCDay(),last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return Array.from({length:42},(_,i)=>{const day=i-first+1;return day>0&&day<=last?`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;});
}
