import React,{useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createChart} from '@/lib/lightweightChartsCompat';
import {CandlestickSeries,ColorType,type UTCTimestamp} from 'lightweight-charts';
import {BounceLevelsPrimitive} from '@/lib/bounceLevelsPrimitive';
import {prepareBounceGexMirror,selectBounceGexMirror} from '@/lib/bounceGexMapMirror';
import {normalizeLinkedGexMapSettings,DEFAULT_LINKED_GEX_MAP_SETTINGS} from '@/lib/gexMapLinkedSettings';
import {projectionFixture} from '../../tests/fixtures/bounceProjection';
const fixture=projectionFixture(),profile=normalizeLinkedGexMapSettings({...DEFAULT_LINKED_GEX_MAP_SETTINGS,viewMode:'full'});
const scale=['#00dddd','#006666','#111111','#770044','#ff00bb'];
(window as any).projectionViews=[];
function View({display}:{display:string}){const host=useRef<HTMLDivElement>(null);useEffect(()=>{
 const factor=display==='QQQ'?1:40;
 const prepared=prepareBounceGexMirror({payload:fixture.payload,settings:profile,displayInstrument:display,displayPriceAt:fixture.displayPriceAt,liveDisplayPrice:fixture.displayPriceAt(Date.parse(fixture.payload.asOf)),colorScale:scale});
 const chart=createChart(host.current!,{width:700,height:470,layout:{background:{type:ColorType.Solid,color:'#000000'},textColor:'#ffffff'},rightPriceScale:{minimumWidth:90},timeScale:{timeVisible:true}});
 const series=chart.addSeries(CandlestickSeries,{upColor:'#fff',downColor:'#888',wickUpColor:'#fff',wickDownColor:'#888'});
 series.setData(fixture.payload.candles.map(c=>({time:c.timestamp/1000 as UTCTimestamp,open:c.open*factor,close:c.close*factor,high:(c.high+5)*factor,low:(c.low-5)*factor})));
 const primitive=new BounceLevelsPrimitive();series.attachPrimitive(primitive);chart.timeScale().fitContent();
 const view={display,prepared,chart,primitive,snapshot:null as any,paint:(clock:number|null)=>{const snapshot=selectBounceGexMirror(prepared,clock);view.snapshot=snapshot;if(!snapshot)return;primitive.update({snapshot,timeAnchors:fixture.payload.candles.map(c=>c.timestamp),opacity:1,intensity:1,minimumNodeHeight:2,maximumNodeHeight:12,minimumOpacity:.08,glowStrength:0,microOrbTexture:false,showHeader:false,showLabels:false,showValues:false,showTouchCount:false,showAirPockets:false,showRolls:false,neutralColor:'#888888',roleColors:{},positiveColor:'#ff00bb',negativeColor:'#00dddd'})}};
 (window as any).projectionViews.push(view);view.paint(null);return()=>{series.detachPrimitive(primitive);chart.remove()};
 },[display]);return <section><h2>{display==='QQQ'?'QQQ source (GEX View price scale)':'QQQ bounce levels projected onto NQ'}</h2><div ref={host}/></section>}
createRoot(document.getElementById('root')!).render(<main style={{display:'flex',gap:16,padding:12}}><View display="QQQ"/><View display="NQ"/></main>);
