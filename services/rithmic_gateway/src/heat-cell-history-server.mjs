import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {HeatCellArchiveReader,heatCellArchiveRequest} from './heat-cell-archive.mjs';
export function createHeatCellHistoryServer({token,reader,now=Date.now}){
 if(!token)throw new Error('Private gateway authentication required.');
 const expected=Buffer.from('Bearer '+token);let windowStart=0,requests=0;
 return createServer({requestTimeout:10000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
  const url=new URL(req.url,'http://archive.internal');
  if(req.method==='GET'&&url.pathname==='/health'&&!url.search)return send(200,{ok:true,service:'gex-data-heat-cell-history',readOnly:true});
  const supplied=Buffer.from(req.headers.authorization||'');
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send(401,{error:'Authentication required.'});
  if(url.pathname!=='/v1/market-data/heat-map-history')return send(404,{error:'Not found.'});
  if(now()-windowStart>=60000){windowStart=now();requests=0}if(++requests>12)return send(429,{error:'Recorded history request limit reached.'});
  const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort()});
  try{const result=await heatCellArchiveRequest(req,url,reader,controller.signal);send(result.status,result.body)}catch{send(502,{error:'Recorded cell history is unavailable.'})}
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const token=process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN;
 const reader=new HeatCellArchiveReader({dir:process.env.RITHMIC_RECORD_DIR||'/recordings',key:token});
 createHeatCellHistoryServer({token,reader}).listen(Number(process.env.HEAT_CELL_HISTORY_PORT||8797),'0.0.0.0');
}
