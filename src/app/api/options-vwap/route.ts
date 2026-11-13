import {NextResponse,type NextRequest} from 'next/server';
import {getRouteActor} from '@/lib/serverAuth';
import {marketDataGatewayUrlCandidatesForPath,marketDataGatewayToken} from '@/lib/marketDataGatewayEnv';
import {fetchWithDeadline} from '@/lib/marketDataRequest';
import {getMarketIndexDefinition} from '@/lib/marketIndices';
import {optionsVwapQuery} from '../../../../services/rithmic_gateway/src/options-vwap-archive.mjs';
export const runtime='nodejs';export const maxDuration=15;
export async function GET(request:NextRequest){
 try{const actor=await getRouteActor(request,{timeoutMs:5000});if(!actor||(process.env.VERCEL&&actor.mode==='local-dev'))return NextResponse.json({error:'Authentication required.'},{status:401});}
 catch{return NextResponse.json({error:'Session verification is temporarily unavailable.'},{status:503});}
 let query;try{query=optionsVwapQuery(new URL(request.url));if(getMarketIndexDefinition(query.symbol)?.group!=='Options Underlyings')throw Error();}
 catch{return NextResponse.json({error:'Choose an options underlying and up to ten calendar days.'},{status:400});}
 try{
  // An archive timeout must never trip the LIVE feed's global origin breaker.
  const origins=marketDataGatewayUrlCandidatesForPath('v1/market-data/options-vwap');
  const origin=origins.find(value=>new URL(value).hostname==='feed.kwantdesk.com')??origins[0];
  if(!origin||!marketDataGatewayToken())throw Error('Archive not configured');
  const response=await fetchWithDeadline(origin+'/v1/market-data/options-vwap?'+new URLSearchParams(query),{cache:'no-store',headers:{Authorization:'Bearer '+marketDataGatewayToken(),...(request.headers.get('if-none-match')?{'If-None-Match':request.headers.get('if-none-match')!}:{})}},10000);
  if(response.status===202 || response.status===429){
   await response.body?.cancel();
   return NextResponse.json({status:'PREPARING_RECORDED_OPTIONS'},{status:202,headers:{'Cache-Control':'private, no-store','Retry-After':response.status===429?'4':'2'}});
  }
  if(response.status===304)return new NextResponse(null,{status:304,headers:{'Cache-Control':'private, no-store',ETag:response.headers.get('etag')||''}});
  if(!response.ok){await response.body?.cancel();return NextResponse.json({error:'Recorded options volume is temporarily unavailable.'},{status:503});}
  const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let length=0;try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>10000000)throw Error('Too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const body=Buffer.concat(chunks).toString('utf8'),payload=JSON.parse(body);if(payload.symbol!==query.symbol||payload.coverage?.kind!=='observed-options-contracts'||!Array.isArray(payload.events)||payload.events.length>100000)throw Error('Invalid archive');
  return new NextResponse(body,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store',ETag:response.headers.get('etag')||''}});
 }catch{return NextResponse.json({error:'Recorded options volume is temporarily unavailable.'},{status:503});}
}
