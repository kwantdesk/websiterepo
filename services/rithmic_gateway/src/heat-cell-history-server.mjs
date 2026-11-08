import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {HeatCellArchiveReader,heatCellArchiveRequest} from './heat-cell-archive.mjs';
import {OptionsVwapArchiveReader,optionsVwapQuery} from './options-vwap-archive.mjs';
export function createHeatCellHistoryServer({token,reader,vwapReader=null,now=Date.now}){
 if(!token)throw new Error('Private gateway authentication required.');
 const expected=Buffer.from('Bearer '+token);let windowStart=0,requests=0;
 return createServer({requestTimeout:10000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
  const url=new URL(req.url,'http://archive.internal');
  if(req.method==='GET'&&url.pathname==='/health'&&!url.search)return send(200,{ok:true,service:'gex-data-heat-cell-history',readOnly:true});
  const supplied=Buffer.from(req.headers.authorization||'');
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send(401,{error:'Authentication required.'});
  if(url.pathname==='/v1/market-data/options-vwap'){
   if(req.method!=='GET')return send(405,{error:'Method not allowed.'});
   let query;try{query=optionsVwapQuery(url,now())}catch{return send(400,{error:'Invalid options range.'})}
   if(!vwapReader)return send(503,{error:'Options archive not configured.'});
   try{let timer;const data=await Promise.race([vwapReader.read(query),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1500)})]).finally(()=>clearTimeout(timer));
    if(!data)return send(202,{status:'PREPARING_RECORDED_OPTIONS',retryAfterMs:2000});
    const etag='"'+createHash('sha256').update(JSON.stringify([data.symbol,data.ids,data.events,data.cancelledIds,data.coverage])).digest('hex')+'"';
    if(req.headers['if-none-match']===etag){res.writeHead(304,{'ETag':etag,'Cache-Control':'private, no-store'});return res.end();}
    res.writeHead(200,{'Content-Type':'application/json','ETag':etag,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(JSON.stringify(data));
   }catch{return send(429,{error:'Recorded options history is preparing. Retry shortly.'})}
  }
  if(url.pathname!=='/v1/market-data/heat-map-history')return send(404,{error:'Not found.'});
  if(now()-windowStart>=60000){windowStart=now();requests=0}if(++requests>12)return send(429,{error:'Recorded history request limit reached.'});
  const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort()});
  try{const result=await heatCellArchiveRequest(req,url,reader,controller.signal);send(result.status,result.body)}catch{send(502,{error:'Recorded cell history is unavailable.'})}
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const token=process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN;
 const reader=new HeatCellArchiveReader({dir:process.env.RITHMIC_RECORD_DIR||'/recordings',key:token});
 createHeatCellHistoryServer({token,reader,vwapReader:new OptionsVwapArchiveReader({dir:process.env.RITHMIC_RECORD_DIR||'/recordings'})}).listen(Number(process.env.HEAT_CELL_HISTORY_PORT||8797),'0.0.0.0');
}
