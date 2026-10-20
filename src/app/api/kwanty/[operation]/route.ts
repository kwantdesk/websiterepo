import {createHash} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {after} from "next/server";
import {kwantyOrderflowArchive} from "@/lib/kwantyOrderflowArchive.server";
import {getRouteActor} from "@/lib/serverAuth";
import {fetchInstitutionalMarketData} from "@/lib/institutionalMarketData.server";
import {conditionalJson} from "@/lib/conditionalJson";
export const runtime="nodejs";
export const maxDuration=45;
export async function GET(request:NextRequest,{params}:{params:Promise<{operation:string}>}){
 const actor=await getRouteActor(request);
 if(!actor||(process.env.VERCEL&&actor.mode==="local-dev"))return NextResponse.json({error:"Authentication required."},{status:401});
 const {operation}=await params;
 if(!["status","catalog","snapshot","history","session"].includes(operation))return NextResponse.json({error:"Unsupported operation."},{status:404});
 const fields=new Set(operation==="session"?["ticker","date"]:["snapshot","history"].includes(operation)?["ticker","package","category","view",...(operation==="history"?["date"]:[])]:[]);
 const query=new URL(request.url).searchParams;
 if(query.toString().length>500||[...query].some(([key,value])=>!fields.has(key)||query.getAll(key).length>1||!/^[A-Za-z0-9_-]{0,32}$/.test(value)))return NextResponse.json({error:"Invalid selection."},{status:400});
 if(operation==="session"){
  const ticker=query.get("ticker")??"",date=query.get("date")??"",time=Date.parse(date+"T00:00:00Z");
  if(!/^[A-Z][A-Z0-9_]{0,31}$/.test(ticker)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date||time>Date.now()||Date.now()-time>90*86400000)return NextResponse.json({error:"Invalid selection."},{status:400});
  const data=await kwantyOrderflowArchive.session(ticker,date);
  return conditionalJson(request,data,{identity:createHash("sha256").update(JSON.stringify(data)).digest("hex"),maxAgeMs:60000});
 }
 try{
  const response=await fetchInstitutionalMarketData(`v1/native-positioning/${operation}?${query}`,{method:"GET"},40000);
  if(!response)return NextResponse.json({error:"POSITIONING_UNAVAILABLE"},{status:503});
  const text=await response.text();if(text.length>16_000_000)throw Error("Response too large");
  const data=JSON.parse(text);
  if(!response.ok&&operation==="history"&&query.get("package")==="orderflow"&&[403,404].includes(response.status)){
   const recorded=await kwantyOrderflowArchive.session(query.get("ticker")??"",query.get("date")??"");
   if(recorded.data.length)return conditionalJson(request,{...recorded,source:"recorded-session"},{identity:createHash("sha256").update(JSON.stringify(recorded)).digest("hex"),maxAgeMs:300000});
  }
  if(!response.ok)return NextResponse.json({error:/^[A-Z_]{3,80}$/.test(data.error)?data.error:"POSITIONING_UNAVAILABLE",retryAfterSeconds:data.retryAfterSeconds},{status:response.status===401?502:response.status,headers:{"Cache-Control":"private, no-store"}});
  if(operation==="snapshot"&&query.get("package")==="orderflow"&&data.data?.ticker===query.get("ticker"))after(()=>kwantyOrderflowArchive.record(data.data));
  const ttl=operation==="history"||operation==="catalog"?300000:15000;
  return conditionalJson(request,data,{identity:createHash("sha256").update(text).digest("hex"),maxAgeMs:ttl});
 }catch{return NextResponse.json({error:"POSITIONING_UNAVAILABLE"},{status:502,headers:{"Cache-Control":"private, no-store"}});}
}
