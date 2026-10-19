import {installTheme} from './site-theme.js';
const hostId=typeof window!=='undefined'?new URLSearchParams(location.search).get('hostId'):null;
const host=typeof window!=='undefined'?(hostId?window.parent?.__kwantOptionsToolHosts?.[hostId]:window.parent?.__kwantyHost):null;
export const botStorage={getItem:key=>host?.read(String(key))??null,setItem:(key,value)=>{if(!host)throw Error('Open KWANTY in your workspace.');host.write(String(key),String(value));},removeItem:key=>host?.write(String(key),null)};
export const botFetch=(url,options)=>{if(!host)throw Error('Open KWANTY in your workspace.');return host.request(url,options);};
export const botTimeZone=()=>host?.timezone()||'America/New_York';
export const botTheme=()=>host?.theme()||{};
if(typeof window!=='undefined'&&host){
 window.__kwantyActive=host.active;await installTheme(host.theme());
 window.addEventListener('message',async event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='kwanty-site-theme'){await installTheme(host.theme());window.dispatchEvent(new Event('kwanty-theme'));}if(event.data?.type==='kwanty-site-activity'){window.__kwantyActive=event.data.active===true;window.dispatchEvent(new Event('kwanty-activity'));}});
}
