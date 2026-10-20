export const SELECT_PREFERENCES_KEY='kwanty:select-preferences:v1';
const RECENT_LIMIT=16,FAVOURITE_LIMIT=200,GROUP_LIMIT=64;
const strings=(values,limit)=>Array.isArray(values)?[...new Set(values.filter(value=>typeof value==='string'&&value.length<=160))].slice(0,limit):[];
const normalize=value=>({recent:strings(value?.recent,RECENT_LIMIT),favourites:strings(value?.favourites,FAVOURITE_LIMIT),showRecents:value?.showRecents!==false,favouritesOnly:value?.favouritesOnly===true});

export function choiceGroup({id='',name='',label='',values=[]}){
  if(id==='ticker')return 'instruments';
  if(/^Metric /i.test(label))return 'orderflow-metrics';
  if(/^Time window /i.test(label))return 'time-windows';
  if(name)return 'setting:'+name.replace(/[^a-z0-9_-]/gi,'').slice(0,60);
  if(id)return 'control:'+id.replace(/[^a-z0-9_-]/gi,'').slice(0,60);
  // Equivalent dynamic dropdowns share a list even when panel IDs differ.
  const signature=[...new Set(values.map(String))].sort().join('\0');let hash=2166136261;
  for(const char of signature){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return 'choices:'+(hash>>>0).toString(16);
}

export function choiceSections(options,preferences,query=''){
  const prefs=normalize(preferences),search=query.trim().toLowerCase(),unique=new Map();
  for(const option of options)if(!unique.has(option.value))unique.set(option.value,option);
  const matches=option=>(!prefs.favouritesOnly||prefs.favourites.includes(option.value))&&(!search||`${option.label} ${option.value}`.toLowerCase().includes(search));
  const candidates=[...unique.values()].filter(matches),seen=new Set(),sections=[];
  const add=(label,rows)=>{const filtered=rows.filter(option=>option&&!seen.has(option.value)&&matches(option));for(const option of filtered)seen.add(option.value);if(filtered.length)sections.push({label,options:filtered});};
  if(prefs.showRecents)add('Recent',prefs.recent.map(value=>unique.get(value)));
  add('Favourites',candidates.filter(option=>prefs.favourites.includes(option.value)).sort((a,b)=>a.label.localeCompare(b.label)));
  if(!prefs.favouritesOnly)add('All options',candidates.filter(option=>!seen.has(option.value)).sort((a,b)=>a.label.localeCompare(b.label)));
  return sections;
}

export function createSelectPreferences(storage){
  const read=()=>{try{const value=JSON.parse(storage.getItem(SELECT_PREFERENCES_KEY)||'{}');return value?.version===1&&value.groups&&typeof value.groups==='object'&&!Array.isArray(value.groups)?value.groups:{};}catch{return {};}};
  const valid=key=>typeof key==='string'&&/^[a-z0-9:_-]{1,80}$/i.test(key)&&!['__proto__','constructor','prototype'].includes(key);
  const get=key=>{const groups=read();return normalize(valid(key)&&Object.hasOwn(groups,key)?groups[key]:null);};
  const save=(key,change)=>{
    if(!valid(key))throw Error('Invalid dropdown preference group.');
    const groups=Object.fromEntries(Object.entries(read()).filter(([group])=>valid(group)).slice(-GROUP_LIMIT));
    const next=normalize(change(get(key)));delete groups[key];groups[key]=next;
    while(Object.keys(groups).length>GROUP_LIMIT)delete groups[Object.keys(groups)[0]];
    // Commit only after the account-backed bridge accepts the complete value.
    storage.setItem(SELECT_PREFERENCES_KEY,JSON.stringify({version:1,groups}));return next;
  };
  return {keyFor:choiceGroup,get,sections:choiceSections,
    select:(key,value)=>save(key,prefs=>({...prefs,recent:[String(value),...prefs.recent.filter(item=>item!==String(value))]})),
    toggleFavourite:(key,value)=>save(key,prefs=>{if(!prefs.favourites.includes(value)&&prefs.favourites.length>=FAVOURITE_LIMIT)throw Error('Favourite limit reached.');return {...prefs,favourites:prefs.favourites.includes(value)?prefs.favourites.filter(item=>item!==value):[...prefs.favourites,value]};}),
    update:(key,patch)=>save(key,prefs=>({...prefs,showRecents:patch.showRecents??prefs.showRecents,favouritesOnly:patch.favouritesOnly??prefs.favouritesOnly})),
  };
}
