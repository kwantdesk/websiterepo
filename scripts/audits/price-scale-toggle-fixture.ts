import {createChart} from '@/lib/lightweightChartsCompat';
import {installPriceScaleDoubleClickToggle} from '@/lib/priceScaleDoubleClickToggle';
const container=document.querySelector<HTMLElement>('#chart')!;
const chart=createChart(container,{width:800,height:500,rightPriceScale:{minimumWidth:70},timeScale:{timeVisible:true},layout:{attributionLogo:false}});
const series=chart.addCandlestickSeries();
series.setData(Array.from({length:100},(_,i)=>({time:(1700000000+i*60) as never,open:100+i/10,high:102+i/10,low:99+i/10,close:101+i/10})));
chart.timeScale().fitContent();chart.priceScale('right').applyOptions({autoScale:false});
const dispose=location.search.includes('native')?()=>{}:installPriceScaleDoubleClickToggle(container,chart);
Object.assign(window,{chart,series,dispose,ready:true});
