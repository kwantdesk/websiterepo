import {NextResponse,type NextRequest} from 'next/server';
import {getRouteActor} from '@/lib/serverAuth';
import {getCboeExpirationCalendar} from '@/lib/cboeExpirationCalendar.server';
import {conditionalJson} from '@/lib/conditionalJson';
export const runtime='nodejs';
export const maxDuration=45;
export async function GET(request:NextRequest){
  const actor=await getRouteActor(request);
  if(!actor||(process.env.VERCEL&&actor.mode==='local-dev'))return NextResponse.json({error:'Authentication required.'},{status:401});
  const query=new URL(request.url).searchParams,raw=query.get('year')??String(new Date().getUTCFullYear());
  if([...query.keys()].some(key=>key!=='year')||query.getAll('year').length>1||!/^20\d{2}$/.test(raw)||Number(raw)<2026||Number(raw)>new Date().getUTCFullYear()+1)return NextResponse.json({error:'Invalid calendar year.'},{status:400});
  const payload=await getCboeExpirationCalendar(Number(raw));
  return conditionalJson(request,payload,{identity:`${raw}:${payload.checkedAt}:${payload.status}:${payload.calendar?.source.sha256}`,maxAgeMs:Math.min(15*60*1000,Math.max(0,Date.parse(payload.nextCheckAt)-Date.now()))});
}
