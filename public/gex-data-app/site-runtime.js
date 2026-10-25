import {installTheme} from './site-theme.js?v=1';
function findHost(){if(typeof window==='undefined')return null;const hostId=new URLSearchParams(location.search).get('hostId');let owner=window;for(let i=0;i<5;i++){try{if(hostId){if(owner.__kwantOptionsToolHosts?.[hostId])return owner.__kwantOptionsToolHosts[hostId];}else if(owner.__kwantGexDataHost)return owner.__kwantGexDataHost;if(owner.parent!==owner)owner=owner.parent;else if(owner.opener)owner=owner.opener;else break;}catch{break;}}return null;}
const host=findHost();
export const gexWorkspaceReplay=()=>host?.replay?.()??null;
export const openWorkspacePalette=()=>{if(!host?.openPalette)return false;host.openPalette();return true;};
export const gexTimeZone=()=>host?.timezone?.()||'Australia/Brisbane';
export const gexStorage={getItem:key=>host?.read(String(key))??null,setItem:(key,value)=>{if(!host)throw Error('Open GEX DATA from your signed-in workspace.');host.write(String(key),String(value));},removeItem:key=>host?.write(String(key),null),snapshot:()=>host?.snapshot()??{},restore:values=>host?.restore(values)};
export async function gexFetch(url,options){if(typeof url==='string'&&url.startsWith('/api/gex-data/')){if(!host)throw Error('Open GEX DATA from your signed-in workspace.');return host.request(url,options);}return fetch(url,options);}
if(typeof window!=='undefined'&&host){
  window.__gexDataActive=host.active;
  await installTheme(host.theme());
  const repaint=async()=>{await installTheme(host.theme());window.dispatchEvent(new CustomEvent('gex-data-preferences'));};
  window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='gex-data-site-theme')void repaint();if(event.data?.type==='gex-data-site-activity'){window.__gexDataActive=event.data.active===true;window.dispatchEvent(new CustomEvent('gex-data-activity'));}});
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='gex-data-site-timezone')window.dispatchEvent(new CustomEvent('gex-data-timezone'));});
  // Text nodes only: internal terminology must not leak out of iframe surfaces.
  const scrub=root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(!['SCRIPT','STYLE'].includes(node.parentElement?.tagName))node.nodeValue=node.nodeValue.replace(/\b(?:QuantData|Rithmic|Databento|Bookmap|Trinity|Menthroq|Skylit)\b/gi,'market data');};
  const observeCopy=()=>{scrub(document.body);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){if(node.nodeType===1)scrub(node);else if(node.nodeType===3&&node.parentElement)scrub(node.parentElement);}}).observe(document.body,{subtree:true,childList:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeCopy,{once:true});else observeCopy();
}
