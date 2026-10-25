import http from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const ORIGINS=new Set(['https://www.kwantdesk.com','https://kwantdesk.com']);
const REPLAY_PATHS=new Set(['/v1/heatmap/replay','/v1/heatmap/replay/chunk']);
const PATHS=new Set(['/v1/market-data/quotes','/v1/market-data/trades','/v1/market-data/index-stream','/v1/heatmap/stream',...REPLAY_PATHS]);
export function verifyBrowserStreamTicket(ticket,key,origin,now=Date.now()) {
 if(!key||!ORIGINS.has(origin)||typeof ticket!=='string'||ticket.length>8192)throw Error('Invalid lease');
 const parts=ticket.split('.');
 if(parts.length!==2||!parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)))throw Error('Invalid lease');
 const expected=createHmac('sha256',key).update('kwantdesk-browser-stream-v1\n'+parts[0]).digest();
 const actual=Buffer.from(parts[1],'base64url');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Invalid lease');
 const p=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
 const seconds=Math.floor(now/1000);
 if(p.v!==1||p.aud!=='kwantdesk-browser-stream'||p.origin!==origin||!PATHS.has(p.path)
  ||typeof p.search!=='string'||p.search.length>4096||(p.search&&!p.search.startsWith('?'))
  ||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>seconds+10
  ||p.exp<=seconds||p.exp-p.iat!==300||p.iat<seconds-300
  ||typeof p.nonce!=='string'||!/^[A-Za-z0-9_-]{16}$/.test(p.nonce))throw Error('Invalid lease');
 return p;
}

export function createBrowserStreamServer({key,upstream='http://gateway:8793',maxStreams=512,now=Date.now}={}) {
 if(!key)throw Error('Stream edge key is required');
 const target=new URL(upstream);
 if(target.protocol!=='http:'||target.username||target.password)throw Error('Invalid internal upstream');
 let active=0,accepted=0,denied=0,lastDeniedOrigin=null;
 return http.createServer((request,response)=>{
  const origin=String(request.headers.origin||'');
  const cors=ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{};
  const fail=(status)=>{response.writeHead(status,{...cors,'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});response.end(JSON.stringify({error:'Market stream unavailable'}));};
  const url=new URL(request.url,'http://stream-edge');
  if(url.pathname==='/health'&&request.method==='GET'){
   response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({ok:true,active,maxStreams,accepted,denied,lastDeniedOrigin}));return;
  }
  if(url.pathname!=='/browser-stream'||request.method!=='GET')return fail(404);
  let lease;
  try{
   if([...url.searchParams.keys()].some(k=>k!=='ticket')||url.searchParams.getAll('ticket').length!==1)throw Error();
   lease=verifyBrowserStreamTicket(url.searchParams.get('ticket'),key,origin,now());
  }catch{denied++;lastDeniedOrigin=ORIGINS.has(origin)?origin:origin==='null'?'null':origin?'other':'missing';return fail(401);}
  if(active>=maxStreams)return fail(503);
  active++;accepted++;
  let released=false,expiry,headersDeadline;
  const release=()=>{if(released)return;released=true;active--;clearTimeout(expiry);clearTimeout(headersDeadline);};
  const contentType=REPLAY_PATHS.has(lease.path)?'application/json':'text/event-stream';
  const relay=http.get({hostname:target.hostname,port:target.port||80,path:lease.path+lease.search,
   headers:{Authorization:'Bearer '+key,Accept:contentType}},upstreamResponse=>{
   clearTimeout(headersDeadline);
   if(upstreamResponse.statusCode!==200||!String(upstreamResponse.headers['content-type']).includes(contentType)){
    upstreamResponse.destroy();if(!response.headersSent)fail(502);release();return;
   }
   response.writeHead(200,{...cors,'Content-Type':contentType,'Cache-Control':'private, no-store, no-transform',
    'X-Accel-Buffering':'no','Referrer-Policy':'no-referrer','X-KwantDesk-Market-Transport':'direct-vps'});
   response.flushHeaders();
   upstreamResponse.on('error',()=>response.destroy());
   // Pipe preserves the raw event framing and applies socket backpressure.
   upstreamResponse.pipe(response);
  });
  headersDeadline=setTimeout(()=>relay.destroy(Error('Header timeout')),15000);
  expiry=setTimeout(()=>{relay.destroy();response.end();release();},Math.max(1,lease.exp*1000-now()));
  relay.on('error',()=>{if(!response.headersSent)fail(502);else response.end();release();});
  response.on('close',()=>{relay.destroy();release();});
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const key=process.env.KWANTDESK_MARKET_DATA_GATEWAY_TOKEN;
 const server=createBrowserStreamServer({key});
 server.listen(8794,'0.0.0.0');
 const close=()=>server.close(()=>process.exit(0));
 process.on('SIGTERM',close);process.on('SIGINT',close);
}
