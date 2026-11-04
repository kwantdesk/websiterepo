import {MARKET_MAP_LABELS} from './market-map-labels.js';
import {squarifyTreemap,marketMapColor} from './chart-primitives.js?v=2';
import {currencyAuto,percentagePointsAuto} from './number-format.js?v=2';
// Public payload observations only; this is not the provider's full industry catalogue.
const enumKey = value => String(value ?? '').trim().toUpperCase().replaceAll(' ', '_');
export function marketMapEnumLabel(value) {
  const key = String(value ?? '').trim();
  if (!key) return '—';
  if(MARKET_MAP_LABELS[key])return MARKET_MAP_LABELS[key];
  return key.replaceAll('_', ' ').toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

export function observeMarketMapIndustries(previous = new Map(), data = {}, limit = 512) {
  const inventory = new Map([...previous].slice(0, limit).map(([industry, sectors]) => [industry, new Set(sectors)]));
  for (const row of Object.values(data || {})) {
    const industry = enumKey(row?.industry), sector = enumKey(row?.sector);
    if (!industry || !inventory.has(industry) && inventory.size >= limit) continue;
    if (!inventory.has(industry)) inventory.set(industry, new Set());
    if (sector) inventory.get(industry).add(sector);
  }
  return inventory;
}

export function marketMapIndustryChoices(inventory = new Map(), sectorSelection = '') {
  const sectors = new Set(String(sectorSelection).split(/[\s,]+/).filter(Boolean).map(enumKey));
  return [...inventory].filter(([, observedSectors]) => !sectors.size || [...observedSectors].some(sector => sectors.has(sector)))
    .map(([industry]) => [industry, marketMapEnumLabel(industry)])
    .sort((a, b) => a[1].localeCompare(b[1]));
}

export function marketMapTooltipRows(item, {formatMarketCap}) {
  if (!item) return [];
  const change = Number(item.change);
  const percentage = Number.isFinite(change) ? `${(Math.round((change+Number.EPSILON)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}%` : '—';
  return [item.ticker, item.companyName || '',
    `Market Cap: ${formatMarketCap(item.weight ?? item.size)}`,
    `Sector: ${marketMapEnumLabel(item.sector)}`,
    `Industry: ${marketMapEnumLabel(item.industry)}`,
    {parts:[{text:`Underlying Price: ${currencyAuto(item.currentValue)} (`},...(change?[{text:change>0?'▲ ':'▼ ',tone:change>0?'bullish':'bearish'}]:[]),{text:percentage+')'}]}].filter(Boolean);
}


export function marketMapTilePercentage(change){return (change>0?'+':'')+percentagePointsAuto(change);}
export function marketMapHeaderTooltipRows(name,grouping){return [marketMapEnumLabel(name),'Click to filter for this '+(grouping==='SECTOR'?'sector':'industry')];}
function fitMarketMapText(ctx,text,width){
  if(width<=0)return '';if(ctx.measureText(text).width<=width)return text;
  const ellipsis=ctx.measureText('…').width;if(ellipsis>width)return '';
  let low=0,high=text.length-1;while(low<high){const middle=Math.ceil((low+high)/2);if(ctx.measureText(text.slice(0,middle)).width+ellipsis<=width)low=middle;else high=middle-1;}
  return low?text.slice(0,low).trimEnd()+'…':'…';
}
// Source20204 paints text in screen coordinates, independently of tile zoom.
export function drawMarketMapFrame(ctx,{groups,grouping,width,height,camera,paint}){
  const hits=[],headers=[],project=rect=>({x:rect.x*camera.zoomX+camera.offsetX,y:rect.y*camera.zoomY+camera.offsetY,width:rect.width*camera.zoomX,height:rect.height*camera.zoomY});
  const visible=rect=>rect.x+rect.width>=0&&rect.x<=width&&rect.y+rect.height>=0&&rect.y<=height;
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  for(const group of squarifyTreemap(groups,{x:0,y:0,width,height})){
    const band=grouping==='NONE'?0:Math.min(16,group.height*.25),screenGroup=project(group);
    if(visible(screenGroup)){ctx.fillStyle=paint('#281047');ctx.fillRect(screenGroup.x,screenGroup.y,screenGroup.width,screenGroup.height);}
    if(band)headers.push({...group,height:band});
    for(const tile of squarifyTreemap(group.item.rows,{x:group.x,y:group.y+band,width:group.width,height:Math.max(0,group.height-band)})){
      hits.push(tile);const screen=project(tile);if(!visible(screen))continue;
      ctx.fillStyle=marketMapColor(tile.item.change);ctx.fillRect(screen.x,screen.y,screen.width,screen.height);ctx.strokeStyle=paint('#0C0216');ctx.lineWidth=.5;ctx.strokeRect(screen.x,screen.y,screen.width,screen.height);
      if(screen.width<32||screen.height<32)continue;const font=Math.floor(Math.min(screen.width,screen.height)*.2);if(font<=0)continue;
      ctx.save();ctx.beginPath();ctx.rect(screen.x,screen.y,screen.width,screen.height);ctx.clip();ctx.fillStyle=paint('#FFFFFF');ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+font+'px Aleph, sans-serif';
      ctx.fillText(tile.item.ticker,screen.x+screen.width/2,screen.y+screen.height/2-(font+2)/2);ctx.fillText(marketMapTilePercentage(tile.item.change),screen.x+screen.width/2,screen.y+screen.height/2+(font+2)/2);ctx.restore();
    }
  }
  const baseFont=Math.max(8,Math.floor(10.24*Math.min(camera.zoomX,camera.zoomY)));
  for(const header of headers){const screen=project(header);if(!visible(screen))continue;const font=Math.min(baseFont,Math.floor(.7*screen.height));if(font<7)continue;
    ctx.font='bold '+font+'px Aleph, sans-serif';const label=fitMarketMapText(ctx,marketMapEnumLabel(header.item.name),screen.width-8);if(!label)continue;
    ctx.save();ctx.beginPath();ctx.rect(screen.x,screen.y,screen.width,screen.height);ctx.clip();ctx.fillStyle=paint('#FFFFFF');ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,screen.x+4,screen.y+screen.height/2);ctx.restore();
  }
  ctx.restore();return {hits,headers};
}
