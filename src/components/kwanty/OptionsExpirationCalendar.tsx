"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,ExternalLink,RefreshCw} from 'lucide-react';
import {writeProtectedItem} from '@/lib/browserStorageQuota';
import {PREFERENCES_HYDRATED_EVENT} from '@/lib/userPreferences';
import verifiedSnapshot from '@/data/cboe-options-2026.json';
import {CALENDAR_CHECK_MS,CBOE_CALENDAR_URL,EXPIRATION_TYPES,MONTHS,calendarDateState,calendarMonthCells,dateLabel,exchangeDate,matchesCalendarDay,visibleCalendarTypes,type ExpirationType,type ExpirationCalendarResponse} from '@/lib/optionsExpirationCalendar';

const KEY='kwantdesk:options-expiration-calendar:v1';
const ALL=Object.keys(EXPIRATION_TYPES) as ExpirationType[];
const products=['All','Equity','ETF / ETN','Equity index','SPX / XSP','VIX'];
type Preferences={year:number;month:number;view:'year'|'month'|'agenda';product:string;enabled:ExpirationType[]};
function readPreferences(accountKey:string):Preferences{
  const today=exchangeDate(),defaults:Preferences={year:Math.max(2026,Number(today.slice(0,4))),month:Number(today.slice(5,7))-1,view:'year',product:'All',enabled:ALL};
  try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(value?.accountKey!==accountKey)return defaults;const p=value.preferences;return {year:Number.isInteger(p.year)&&p.year>=2026&&p.year<=new Date().getUTCFullYear()+1?p.year:defaults.year,month:Number.isInteger(p.month)&&p.month>=0&&p.month<12?p.month:defaults.month,view:['year','month','agenda'].includes(p.view)?p.view:'year',product:products.includes(p.product)?p.product:'All',enabled:Array.isArray(p.enabled)?p.enabled.filter((type:ExpirationType)=>ALL.includes(type)):ALL};}catch{return defaults;}
}
function Swatch({color}:{color:string}){return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-sm border border-foreground/30" style={{backgroundColor:color}}/>;}
export default function OptionsExpirationCalendar({accountKey,active=true}:{accountKey:string;active?:boolean}){
  const [preferences,setPreferences]=useState(()=>readPreferences(accountKey));
  const [today,setToday]=useState(exchangeDate),[selected,setSelected]=useState(exchangeDate),[search,setSearch]=useState(''),[upcoming,setUpcoming]=useState(true);
  const [payload,setPayload]=useState<ExpirationCalendarResponse|null>(()=>preferences.year===verifiedSnapshot.year?{calendar:verifiedSnapshot as ExpirationCalendarResponse['calendar'],availableYears:[2026],checkedAt:verifiedSnapshot.source.retrievedAt,nextCheckAt:verifiedSnapshot.source.retrievedAt,status:'stale',message:'Showing the last verified calendar while checking Cboe’s latest source.'}:null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[saveError,setSaveError]=useState(false);
  const [refresh,setRefresh]=useState(0),nextCheck=useRef(0);
  const {year,month,view,product,enabled}=preferences;
  const update=(patch:Partial<Preferences>)=>setPreferences(previous=>({...previous,...patch}));
  const chooseDate=(date:string)=>{setSelected(date);update({month:Number(date.slice(5,7))-1});};
  useEffect(()=>{const hydrated=()=>setPreferences(readPreferences(accountKey));window.addEventListener(PREFERENCES_HYDRATED_EVENT,hydrated);return()=>window.removeEventListener(PREFERENCES_HYDRATED_EVENT,hydrated);},[accountKey]);
  useEffect(()=>{const result=writeProtectedItem(KEY,JSON.stringify({accountKey,preferences}));setSaveError(!result.ok);},[accountKey,preferences]);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();let disposed=false;
    setLoading(true);setError(null);
    fetch(`/api/options-expiration-calendar?year=${year}`,{signal:controller.signal,credentials:'same-origin'}).then(async response=>{if(!response.ok)throw Error(response.status===401?'Sign in to view the calendar.':'The calendar source is unavailable.');const value=await response.json() as ExpirationCalendarResponse;if(!['current','stale','unavailable'].includes(value.status)||value.calendar&&value.calendar.year!==year)throw Error('Calendar verification failed.');if(!disposed){setPayload(value);nextCheck.current=Date.parse(value.nextCheckAt)||Date.now()+CALENDAR_CHECK_MS;}}).catch(reason=>{if(!disposed&&reason.name!=='AbortError'){setError(reason.message);nextCheck.current=Date.now()+15*60*1000;}}).finally(()=>{if(!disposed)setLoading(false);});
    return()=>{disposed=true;controller.abort();};
  },[year,active,refresh]);
  useEffect(()=>{
    if(!active)return;
    const check=()=>{if(document.hidden)return;setToday(exchangeDate());if(nextCheck.current&&Date.now()>=nextCheck.current){nextCheck.current=Date.now()+60000;setRefresh(value=>value+1);}};
    const timer=window.setInterval(check,60000);document.addEventListener('visibilitychange',check);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);};
  },[active]);
  const calendar=payload?.calendar?.year===year?payload.calendar:null;
  const days=useMemo(()=>new Map(calendar?.days.map(day=>[day.date,day])??[]),[calendar]);
  const matched=useMemo(()=>new Set((calendar?.days??[]).filter(day=>matchesCalendarDay(day,enabled,product,search)).map(day=>day.date)),[calendar,enabled,product,search]);
  const selectedDay=days.get(selected),agenda=(calendar?.days??[]).filter(day=>matched.has(day.date)&&(!upcoming||day.date>=today));
  const dateInfo=(type:ExpirationType)=>type==='leaps'?`New ${calendar?.leapsYear} Equity / ETP LEAPS added`:EXPIRATION_TYPES[type].label;
  const years=[...new Set([year,...(payload?.availableYears??[2026])])].sort();
  const status=error?'stale':payload?.status;
  const goToday=()=>{update({year:Number(today.slice(0,4)),month:Number(today.slice(5,7))-1});setSelected(today);};
  const moveMonth=(amount:number)=>{const next=new Date(Date.UTC(year,month+amount,1));if(next.getUTCFullYear()>=2026&&next.getUTCFullYear()<=new Date().getUTCFullYear()+1)update({year:next.getUTCFullYear(),month:next.getUTCMonth()});};
  const monthPanel=(index:number)=><section key={index} className="min-w-0 rounded border border-border bg-panel p-3" aria-label={`${MONTHS[index]} ${year}`}>
    <button className="mb-2 text-base text-foreground hover:text-primary" onClick={()=>update({month:index,view:'month'})}>{MONTHS[index]} <span className="text-xs text-muted">{year}</span></button>
    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted" aria-hidden="true">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(label=><span key={label}>{label}</span>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">{calendarMonthCells(year,index).map((date,i)=>{
      if(!date)return <span key={`empty-${i}`} aria-hidden="true"/>;
      const day=days.get(date),visible=day?visibleCalendarTypes(day,enabled,product,search):[],match=matched.has(date),label=day?.types.map(dateInfo).join('; ')||'No event marked in Cboe calendar';
      const state=calendarDateState(date,today,selected);
      return <button key={date} onClick={()=>chooseDate(date)} aria-label={`${dateLabel(date)}. ${state.today?'Today. ':state.past?'Past date. ':''}${label}`} aria-current={state.today?'date':undefined} aria-pressed={state.selected} data-past={state.past} title={`${dateLabel(date)}${state.today?' · Today':state.past?' · Past date':''}\n${label}`} className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded border px-0.5 py-1 text-xs transition-colors hover:border-primary hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary ${state.selected?'border-primary bg-primary/20':'border-transparent bg-surface/40'} ${state.past?(state.selected?'opacity-75':'opacity-45'):!match&&!state.today&&!state.selected?'opacity-70':''} ${state.today?'ring-2 ring-primary':''}`}>
        <span className={`leading-none text-foreground ${state.today||state.selected?'text-base font-bold':'text-sm font-semibold'}`}>{Number(date.slice(-2))}</span>
        <span className="flex h-1.5 w-full gap-px" aria-hidden="true">{visible.map(type=><span key={type} className="min-w-0 flex-1 rounded-sm border border-foreground/15" style={{background:calendar?.colors[type]}}/>)}</span>
        <span className={`h-2 text-[8px] font-bold uppercase leading-none ${state.today?'text-primary':'text-muted'}`} aria-hidden="true">{state.today?'Today':state.selected?'●':''}</span>
      </button>;
    })}</div>
  </section>;
  return <section className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Options expiration calendar">
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-3">
      <CalendarDays className="h-5 w-5 text-primary"/><h1 className="text-lg">Options Expiration Calendar</h1>
      <span className="text-xs text-muted">Cboe · U.S. options · dates in New York</span>
      <a href={calendar?.source.url??CBOE_CALENDAR_URL} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-xs text-primary">Official source <ExternalLink className="h-3 w-3"/></a>
    </header>
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <button className="rounded border border-border px-3 py-1.5 text-sm hover:border-primary" onClick={goToday}>Today</button>
        <select aria-label="Calendar year" value={year} onChange={event=>update({year:Number(event.target.value)})} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">{years.map(y=><option key={y}>{y}</option>)}</select>
        {view==='month'?<><button aria-label="Previous month" onClick={()=>moveMonth(-1)} className="rounded border border-border p-1.5"><ChevronLeft size={16}/></button><select aria-label="Calendar month" className="rounded border border-border bg-panel p-1.5 text-sm" value={month} onChange={e=>update({month:Number(e.target.value)})}>{MONTHS.map((name,i)=><option key={name} value={i}>{name}</option>)}</select><button aria-label="Next month" onClick={()=>moveMonth(1)} className="rounded border border-border p-1.5"><ChevronRight size={16}/></button></>:null}
        <div className="flex rounded border border-border" aria-label="Calendar display">{(['year','month','agenda'] as const).map(mode=><button key={mode} aria-pressed={view===mode} className={`px-3 py-1.5 text-sm capitalize ${view===mode?'bg-primary/10 text-primary':''}`} onClick={()=>update({view:mode})}>{mode}</button>)}</div>
        <select aria-label="Filter product" value={product} onChange={event=>update({product:event.target.value})} className="rounded border border-border bg-panel px-2 py-1.5 text-sm">{products.map(p=><option key={p} value={p}>{p==='All'?'All products':p}</option>)}</select>
        <input aria-label="Search calendar events" placeholder="Search dates or events…" value={search} onChange={e=>setSearch(e.target.value.slice(0,100))} className="min-w-36 flex-1 rounded border border-border bg-panel px-3 py-1.5 text-sm"/>
        <button aria-label="Refresh calendar status" disabled={loading} title="Refresh status; shared Cboe source checks are cached for six hours" className="rounded border border-border p-2 disabled:opacity-40" onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={15} className={loading?'animate-spin':''}/></button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface/40 px-4 py-3 text-xs" aria-label="Current and selected calendar dates">
        <p><span className="mr-2 font-bold uppercase tracking-wide text-primary">Today</span><time dateTime={today} className="font-semibold">{dateLabel(today)}</time><span className="ml-2 text-muted">New York</span></p>
        <p><span className="mr-2 text-muted">Selected date</span>{selected.startsWith(`${year}-`)?<time dateTime={selected} className="font-semibold">{dateLabel(selected)}</time>:<span>Choose a date in {year}</span>}</p>
        <p className="text-muted">Today outlined · selected highlighted · past dates dimmed</p>
      </div>
      {saveError?<p role="status" className="px-4 py-2 text-sm text-danger">Calendar preferences could not be saved on this device.</p>:null}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border px-4 py-3" aria-label="Cboe colour legend and filters">
        {ALL.map(type=><label key={type} className="flex cursor-pointer items-center gap-1.5 text-xs" title={EXPIRATION_TYPES[type].description}><input type="checkbox" checked={enabled.includes(type)} onChange={()=>update({enabled:enabled.includes(type)?enabled.filter(t=>t!==type):[...enabled,type]})} aria-label={`Show ${EXPIRATION_TYPES[type].label}`} className="accent-primary"/><Swatch color={calendar?.colors[type]??'#777777'}/>{dateInfo(type)}</label>)}
        <button className="text-xs text-primary underline" onClick={()=>{update({enabled:ALL,product:'All'});setSearch('');}}>Reset filters</button>
      </div>
      <div role="status" className={`border-b border-border px-4 py-2 text-xs ${status==='stale'||status==='unavailable'?'text-warning':'text-muted'}`}>
        {loading?'Checking Cboe’s published calendar…':error||payload?.message||'Source verified · automatic checks every six hours while open.'}
        {calendar?<span className="ml-2">Verified {new Date(calendar.source.retrievedAt).toLocaleString('en-AU',{dateStyle:'medium',timeStyle:'short'})} · revision {calendar.source.sha256.slice(0,8)}. {calendar.source.lastModified?`Cboe file modified ${new Date(calendar.source.lastModified).toLocaleDateString('en-AU',{dateStyle:'medium'})}.`:''}</span>:null}
      </div>
      {calendar?<div className="grid shrink-0 grid-cols-1 items-start gap-4 p-4 min-[1000px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">{view==='year'?<div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">{MONTHS.map((_,i)=>monthPanel(i))}</div>:view==='month'?<div className="mx-auto max-w-3xl [&_button]:min-h-12">{monthPanel(month)}</div>:<section className="rounded border border-border bg-panel p-3" aria-label="Expiration agenda"><label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={upcoming} onChange={e=>setUpcoming(e.target.checked)} className="accent-primary"/>Upcoming dates only</label>{!agenda.length?<p className="p-4 text-sm text-muted">No dates match these filters.</p>:agenda.map(day=><button key={day.date} onClick={()=>chooseDate(day.date)} aria-current={day.date===today?'date':undefined} aria-pressed={selected===day.date} data-past={day.date<today} className={`flex w-full flex-wrap items-center gap-3 border-b border-border py-3 text-left text-sm hover:opacity-100 focus-visible:opacity-100 ${selected===day.date?'bg-primary/20':''} ${day.date<today?(selected===day.date?'opacity-75':'opacity-45'):''} ${day.date===today?'border-l-2 border-l-primary pl-2':''}`}><span className="w-44 shrink-0 font-semibold">{dateLabel(day.date)}{day.date===today?<span className="ml-2 text-xs font-bold text-primary">Today</span>:day.date<today?<span className="ml-2 text-xs text-muted">Past</span>:null}</span><span className="flex flex-wrap gap-2">{visibleCalendarTypes(day,enabled,product,search).map(type=><span key={type} className="flex items-center gap-1.5 text-xs"><Swatch color={calendar.colors[type]}/>{dateInfo(type)}</span>)}</span></button>)}</section>}</div>
        <aside className="sticky top-0 max-h-[65dvh] min-w-0 overflow-y-auto rounded border border-border bg-panel p-4" aria-label="Selected date details">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">Selected date{selected.startsWith(`${year}-`)?selected===today?' · Today':selected<today?' · Past':'':''}</p>
          <h2 className="mb-1 text-base font-semibold">{selected.startsWith(`${year}-`)?dateLabel(selected):'Choose a date'}</h2>
          <p className="mb-4 text-xs text-muted">Exchange date · America/New_York</p>
          {selectedDay?.types.length?selectedDay.types.map(type=><article key={type} className="mb-3 border-b border-border pb-3"><h3 className="mb-2 flex items-start gap-2 text-sm"><Swatch color={calendar.colors[type]}/>{dateInfo(type)}</h3><p className="text-xs leading-relaxed text-muted">{EXPIRATION_TYPES[type].description}</p>{type==='am-last-trade'||type==='vix-last-trade'?<p className="mt-2 text-xs text-warning">Last trading day—not the expiration/settlement date.</p>:null}{type==='leaps'?<p className="mt-2 text-xs text-primary">Listing year: {calendar.leapsYear}. This is not a {calendar.leapsYear} expiry date.</p>:null}</article>):<p className="mb-4 text-sm text-muted">{selectedDay?'No event is marked for this date in Cboe’s annual calendar.':'Select a date in the calendar.'}</p>}
          <p className="text-xs leading-relaxed text-muted">Schedule reference, not a live options chain. Actual listed series, settlement style, trading hours and broker cutoffs must be checked for the contract. Newly announced series may not yet appear in the annual PDF. Dates are subject to change.</p>
          <a href={CBOE_CALENDAR_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary">Cboe hours and holidays <ExternalLink size={12}/></a>
        </aside>
      </div>:<div className="p-8 text-sm text-muted">{loading?'Loading the verified calendar…':'No verified calendar is available for this year. Choose a published year or open Cboe’s source.'}</div>}
      <footer className="border-t border-border px-4 py-3 text-xs text-muted">Calendar dates and colour key sourced from Cboe. Semantic colours intentionally stay consistent across site themes. No live market-data subscription is required.</footer>
    </div>
  </section>;
}
