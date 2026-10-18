// Local UI QA fixture only: all provider requests are intercepted by this test host.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('public');
const fixturePrices=Object.fromEntries(['13:30','13:31','13:35'].map((time,index)=>[Date.parse(`2026-10-16T${time}:00Z`),{openPrice:100+index,highPrice:102+index,lowPrice:99+index,closePrice:101+index,volume:10}]));
const host=`<script>window.__kwantGexDataHost={active:true,read:key=>localStorage.getItem('gex-controls-preview:'+key),write:(key,value)=>value===null?localStorage.removeItem('gex-controls-preview:'+key):localStorage.setItem('gex-controls-preview:'+key,value),theme:()=>({background:'#080c14',panel:'#111a29',surface:'#182239',foreground:'#dce7f5',muted:'#8294ad',border:'#28364c',primary:'#4fb3ff',danger:'#ff607f',warning:'#eebc64',bullish:'#32cf8a',bearish:'#ff607f'}),timezone:()=> 'America/New_York',instruments:()=>[['QQQ','QQQ — Nasdaq ETF'],['SPY','SPY — S&P ETF'],['SPX','SPX — Index'],['NDX','NDX — Index'],['AAPL','AAPL — Apple']],snapshot:()=>({}),restore:()=>{},request:async(url)=>new Response(JSON.stringify(url.endsWith('/status')?{connected:true,market:{open:false,optionsOpen:false,equitiesOpen:false,sessionDate:'2026-10-16',optionsSessionDate:'2026-10-16'}}:{data:{},_gexData:{requestedSessionDate:'2026-10-16',gatewayFetchedAt:new Date().toISOString()}}),{headers:{'Content-Type':'application/json'}})};</script>`;
const priceHost=`<script>{const other=window.__kwantGexDataHost.request;window.__kwantGexDataHost.request=async(url,options)=>url.endsWith('/stock-price-over-time')?new Response(JSON.stringify({data:${JSON.stringify(fixturePrices)}}),{headers:{'Content-Type':'application/json'}}):other(url,options);}</script>`;
http.createServer(async(request,response)=>{
 try{
  const url=new URL(request.url,'http://127.0.0.1:3125'),path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/gex-data-app/index.html':url.pathname));
  if(!path.startsWith(root+sep))return response.writeHead(403).end();
  let body=await readFile(path);if(path.endsWith('index.html'))body=Buffer.from(body.toString().replace('<head>','<head>'+host+priceHost).replace('</body>','<div style="position:fixed;bottom:5px;left:5px;font:10px sans-serif;color:#8294ad;pointer-events:none">LOCAL UI PREVIEW · SYNTHETIC DATA</div></body>'));
  response.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf'})[extname(path)]||'application/octet-stream'});response.end(body);
 }catch{response.writeHead(404).end();}
}).listen(3125,'127.0.0.1',()=>console.log('GEX DATA controls fixture: http://127.0.0.1:3125/?embed=1#tool=interval-map — no live provider data'));
