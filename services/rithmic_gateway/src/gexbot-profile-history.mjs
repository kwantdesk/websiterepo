import {mkdir,readFile,writeFile,rename,rm,statfs,readdir,lstat} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import {extractEodSession,eodEntryName} from './gexbot-eod-session.mjs';
const zip=promisify(gzip),unzip=promisify(gunzip);
function fail(code,status=502){throw Object.assign(Error(code),{code,status});}
const profileKeys=new Set(['strikes','mini_contracts']);
async function storedBytes(root){
 let bytes=0,count=0;
 const walk=async(path,depth)=>{if(depth>6)fail('EOD_STORAGE_LIMIT',507);for(const entry of await readdir(path,{withFileTypes:true})){if(++count>20000||entry.isSymbolicLink())fail('EOD_STORAGE_LIMIT',507);const name=join(path,entry.name);if(entry.isDirectory())await walk(name,depth+1);else if(entry.isFile())bytes+=(await lstat(name)).size;else fail('EOD_STORAGE_LIMIT',507);}};
 await walk(root,0);return bytes;
}
export function createProfileHistory({dir,eod,extract=extractEodSession}){
 const pending=new Map();let building=false;
 async function prepare(selection){
  const {ticker,package:pkg,category,date}=selection;
  eodEntryName(selection);if(!['classic','state'].includes(pkg))fail('EOD_INVALID_SELECTION',400);
  const target=join(dir,ticker,pkg,category,date);
  try{return {target,manifest:JSON.parse(await readFile(join(target,'manifest.json'),'utf8'))};}catch(error){if(error.code!=='ENOENT')throw error;}
  if(pending.has(target))return pending.get(target);
  if(building)fail('EOD_INDEX_BUSY',503);
  building=true;
  const job=(async()=>{
   const archive=await eod.archivePath(ticker,date);
   await mkdir(dir,{recursive:true,mode:0o700});const space=await statfs(dir);if(Number(space.bavail)*Number(space.bsize)<1024*1024*1024||await storedBytes(dir)>2*1024*1024*1024-160*1024*1024)fail('EOD_STORAGE_LIMIT',507);
   await mkdir(join(target,'..'),{recursive:true});const partial=target+'.partial-'+randomUUID();
   if(!resolve(partial).startsWith(resolve(dir)+sep))fail('EOD_INVALID_SELECTION',400);
   await mkdir(partial,{mode:0o700});let rows=[],size=0,total=0,packed=0;const summaries=[],pages=[];
   const flush=async()=>{if(!rows.length)return;const bytes=await zip(JSON.stringify(rows),{level:1});packed+=bytes.length;if(packed>128*1024*1024)fail('EOD_INDEX_SIZE_LIMIT');await writeFile(join(partial,pages.length+'.json.gz'),bytes,{flag:'wx',mode:0o600});pages.push({first:rows[0].timestamp,last:rows.at(-1).timestamp,count:rows.length});rows=[];size=0;};
   try{
    await extract(archive,selection,{onRow:async row=>{
     const length=Buffer.byteLength(JSON.stringify(row));if(length>2_000_000)fail('EOD_ROW_SIZE_LIMIT');
     if(rows.length>=200||size+length>2_000_000)await flush();
     const summary=Object.fromEntries(Object.entries(row).filter(([key])=>!profileKeys.has(key)));summary.profilePage=pages.length;
     total+=Buffer.byteLength(JSON.stringify(summary));if(total>12_000_000)fail('EOD_INDEX_SIZE_LIMIT');summaries.push(summary);rows.push(row);size+=length;
    }});await flush();
    const manifest={data:summaries,ticker,package:pkg,category,sessionDate:date,source:'provider-eod-archive',coverage:'provider-session',providerAsOf:new Date(summaries.at(-1).timestamp*1000).toISOString(),profilePages:pages};
    await writeFile(join(partial,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});await rename(partial,target);return {target,manifest};
   }catch(error){await rm(partial,{recursive:true,force:true});throw error;}
  })().finally(()=>{building=false;pending.delete(target);});pending.set(target,job);return job;
 }
 return {async read(selection,page=null){
  if(page!==null&&(!/^\d{1,3}$/.test(String(page))))fail('EOD_INVALID_SELECTION',400);
  let timer;const work=prepare(selection);
  let prepared;try{prepared=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('EOD_INDEX_BUILDING'),{code:'EOD_INDEX_BUILDING',status:503})),4000);})]);}finally{clearTimeout(timer);}
  const {target,manifest}=prepared;
  if(page===null)return manifest;
  if(!manifest.profilePages[Number(page)])fail('EOD_INVALID_SELECTION',400);
  const bytes=await readFile(join(target,Number(page)+'.json.gz'));if(bytes.length>4_000_000)fail('EOD_INDEX_SIZE_LIMIT');
  const data=JSON.parse((await unzip(bytes,{maxOutputLength:3_000_000})).toString('utf8'));
  return {...manifest,data,profilePages:undefined,page:Number(page)};
 }};
}
