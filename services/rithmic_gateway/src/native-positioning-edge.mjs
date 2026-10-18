import {createProvider,resolveKey,ProviderError} from './native-positioning-provider.mjs';
export async function createNativePositioningEdge(env=process.env){
 const provider=createProvider({key:await resolveKey(env)});
 return {canHandle:pathname=>pathname.startsWith('/v1/native-positioning/'),async handle(request,response,url){
  const send=(status,body)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
  if(request.method!=='GET')return send(405,{error:'METHOD_NOT_ALLOWED'});
  const operation=url.pathname.slice('/v1/native-positioning/'.length),fields=new Set(['snapshot','history'].includes(operation)?['ticker','package','category','view',...(operation==='history'?['date']:[])]:[]);
  if(!['status','catalog','snapshot','history'].includes(operation))return send(404,{error:'UNSUPPORTED_OPERATION'});
  if([...url.searchParams].some(([key])=>!fields.has(key)||url.searchParams.getAll(key).length>1))return send(400,{error:'UNSUPPORTED_PARAMETER'});
  try{return send(200,await provider[operation](Object.fromEntries(url.searchParams)));}
  catch(error){return send(error instanceof ProviderError?error.status:502,{error:error instanceof ProviderError?error.code:'POSITIONING_UNAVAILABLE',...(error.retryAfterSeconds?{retryAfterSeconds:error.retryAfterSeconds}:{})});}
 }};
}
