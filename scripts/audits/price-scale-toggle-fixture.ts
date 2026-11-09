import {createChart} from '@/lib/lightweightChartsCompat';
import {installPriceScaleDoubleClickToggle} from '@/lib/priceScaleDoubleClickToggle';
const container=document.querySelector<HTMLElement>('#chart')!;
const chart=createChart(container,{width:800,height:500,rightPriceScale:{minimumWidth:70},timeScale:{timeVisible:true},layout:{attributionLogo:false}});
const series=chart.addCandlestickSeries();
series.setData(Array.from({length:100},(_,i)=>({time:(1700000000+i*60) as never,open:100+i/10,high:102+i/10,low:99+i/10,close:101+i/10})));
chart.timeScale().fitContent();chart.priceScale('right').applyOptions({autoScale:false});
let topInset=0,bottomInset=0,anchorPrice=110.9;
const dispose=location.search.includes('native')?()=>{}:installPriceScaleDoubleClickToggle(container,chart,
  location.search.includes('center') ? ()=>({price:anchorPrice,topInset,bottomInset,coordinateToPrice:y=>series.coordinateToPrice(y)}) : undefined);
const layout=(width:number,height:number,top:number,bottom:number,invertScale=false,price=110.9)=>{
  topInset=top;bottomInset=bottom;anchorPrice=price;chart.resize(width,height);
  const paneHeight=chart.paneSize().height;
  chart.priceScale('right').applyOptions({invertScale,scaleMargins:{top:(top+8)/paneHeight,bottom:(bottom+8)/paneHeight}});
};
Object.assign(window,{chart,series,dispose,layout,ready:true});
