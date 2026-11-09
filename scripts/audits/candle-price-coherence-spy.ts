// Test-only observation of actual Lightweight Charts API calls. Production
// imports the unmodified adapter; no synthetic feed or spy ships in the app.
import {createChart as original} from '../../src/lib/lightweightChartsCompat';
export * from '../../src/lib/lightweightChartsCompat';
export function createChart(...args:Parameters<typeof original>){
  const chart=original(...args),add=chart.addCandlestickSeries.bind(chart);
  const target=window as unknown as {pricePaints:Array<{key:string;price:number;at:number}>;candleWrites:number};
  target.pricePaints??=[];target.candleWrites??=0;
  chart.addCandlestickSeries=(options)=>{
    const series=add(options),create=series.createPriceLine.bind(series),update=series.update.bind(series),setData=series.setData.bind(series);
    const container=args[0] as HTMLElement,key=container.closest('[data-chart-instance-id]')?.getAttribute('data-chart-instance-id')||'';
    series.update=(...params)=>{target.candleWrites++;(window as any).candlePaints??=[];(window as any).candlePaints.push({key,...params[0],at:performance.now()});return update(...params);};
    series.setData=(...params)=>{target.candleWrites++;return setData(...params);};
    series.createPriceLine=options=>{
      const line=create(options),apply=line.applyOptions.bind(line);
      if(options.title==='')target.pricePaints.push({key,price:Number(options.price),at:performance.now()});
      line.applyOptions=next=>{if(next.price!=null)target.pricePaints.push({key,price:Number(next.price),at:performance.now()});return apply(next);};
      return line;
    };(window as any).seriesByKey??={};(window as any).seriesByKey[key]=series;return series;
  };return chart;
}
