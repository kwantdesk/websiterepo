import {createHash} from 'node:crypto';
import {MONTHS,type ExpirationCalendar,type ExpirationType} from './optionsExpirationCalendar.ts';

type Point=[number,number];
type Shape={color:string;points:Point[];box:number[]};
type Text={str:string;width:number;height:number;transform:number[]};
const identity=[1,0,0,1,0,0];
const at=(m:number[],x:number,y:number):Point=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function multiply(a:number[],b:number[]){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function contains(shape:Shape,x:number,y:number){
  if(x<shape.box[0]||x>shape.box[2]||y<shape.box[1]||y>shape.box[3])return false;
  let inside=false;for(let i=0,j=shape.points.length-1;i<shape.points.length;j=i++){const a=shape.points[i],b=shape.points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
}
function regression(values:Point[]){const n=values.length,sx=values.reduce((s,p)=>s+p[0],0),sy=values.reduce((s,p)=>s+p[1],0),xx=values.reduce((s,p)=>s+p[0]*p[0],0),xy=values.reduce((s,p)=>s+p[0]*p[1],0),slope=(n*xy-sx*sy)/(n*xx-sx*sx);return {slope,origin:(sy-slope*sx)/n};}
const legendOrder:ExpirationType[]=['standard','am-last-trade','vix-last-trade','vix-standard','vix-exception','vix-weekly','spx-weekly','month-end','holiday','leaps'];
function legendType(label:string):ExpirationType{
  if(/AM-Settled/.test(label))return 'am-last-trade';
  if(/Exception/.test(label))return 'vix-exception';
  if(/Last day.*VIX/.test(label))return 'vix-last-trade';
  if(/VIX.*Standard/.test(label))return 'vix-standard';
  if(/VIX.*Weeklys/.test(label))return 'vix-weekly';
  if(/SPX.*XSP/.test(label))return 'spx-weekly';
  if(/End-of-Month/.test(label))return 'month-end';
  if(/Exchange Holiday/.test(label))return 'holiday';
  if(/LEAPS/.test(label))return 'leaps';
  if(/Equity.*Standard Expiration/.test(label))return 'standard';
  throw Error('Unrecognised legend category.');
}
/** Read published dates AND visible coloured vectors; never regenerate dates from a weekday rule. */
export async function parseCboeCalendar(bytes:Uint8Array,year:number,source:Omit<ExpirationCalendar['source'],'sha256'>):Promise<ExpirationCalendar>{
  if(bytes.length>5_000_000||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Unrecognised Cboe PDF.');
  const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:bytes.slice(),useSystemFonts:true,isEvalSupported:false,stopAtErrors:true,maxImageSize:2_000_000,disableFontFace:true});
  const doc=await task.promise;
  try{
    if(doc.numPages!==1)throw Error('The Cboe calendar layout changed.');
    const page=await doc.getPage(1),text=(await page.getTextContent()).items.filter((item):item is Text&{dir:string;fontName:string;hasEOL:boolean}=>'str' in item),ops=await page.getOperatorList();
    if(text.length>5000||ops.fnArray.length>100000)throw Error('The Cboe calendar is too complex.');
    if(!text.some(item=>item.str.includes(String(year))&&item.transform[5]>page.view[3]*.75))throw Error('The PDF year does not match.');
    const anchors=MONTHS.map((month,index)=>{const item=text.find(t=>t.str.trim()===month);if(!item)throw Error('A calendar month is missing.');return {month:index,x:item.transform[4]+item.width/2,y:item.transform[5]};});
    const shapes:Shape[]=[],stack:Array<{matrix:number[];color:string}>=[];let matrix=identity.slice(),color='#000000';
    const fills=new Set([OPS.fill,OPS.eoFill,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]);
    for(let i=0;i<ops.fnArray.length;i++){
      const op=ops.fnArray[i],args=ops.argsArray[i];
      if(op===OPS.save)stack.push({matrix:matrix.slice(),color});
      else if(op===OPS.restore){const state=stack.pop();if(state){matrix=state.matrix;color=state.color;}}
      else if(op===OPS.transform)matrix=multiply(matrix,Array.from(args));
      else if(op===OPS.setFillRGBColor)color=String(args[0]).toLowerCase();
      else if(op===OPS.constructPath&&fills.has(args[0])){
        const box=Array.from(args[2] as ArrayLike<number>),corners=[at(matrix,box[0],box[1]),at(matrix,box[2],box[3])],w=Math.abs(corners[1][0]-corners[0][0]),h=Math.abs(corners[1][1]-corners[0][1]);
        if(w<1||h<1||w>25||h>25||Math.max(...corners.map(p=>p[1]))>Math.max(...anchors.map(a=>a.y))-10||Math.min(...corners.map(p=>p[1]))<35)continue;
        const data=Array.from(args[1][0] as ArrayLike<number>),points:Point[]=[];let supported=true;
        for(let j=0;j<data.length;){const command=data[j++];if(command===0||command===1){points.push(at(matrix,data[j],data[j+1]));j+=2;}else if(command!==4){supported=false;break;}}
        if(!supported||points.length<3)throw Error('Unsupported calendar marker geometry.');
        shapes.push({color,points,box:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]});
      }
    }
    const legendX=Math.max(...anchors.map(a=>a.x))+65;
    const legend=shapes.filter(s=>s.box[0]>legendX&&s.box[2]-s.box[0]>10&&s.box[3]-s.box[1]>10).sort((a,b)=>b.box[1]-a.box[1]);
    if(legend.length!==10||new Set(legend.map(s=>s.color)).size!==10)throw Error('The calendar colour legend changed.');
    const legendTypes=legend.map((shape,i)=>legendType(text.filter(t=>t.transform[4]>shape.box[2]&&t.transform[5]<shape.box[3]+4&&t.transform[5]>(legend[i+1]?.box[3]??0)+4).sort((a,b)=>Math.abs(a.transform[5]-b.transform[5])>3?b.transform[5]-a.transform[5]:a.transform[4]-b.transform[4]).map(t=>t.str).join(' ')));
    if(new Set(legendTypes).size!==10)throw Error('Duplicate calendar legend category.');
    const colors=Object.fromEntries(legend.map((shape,i)=>[legendTypes[i],shape.color])) as Record<ExpirationType,string>;colors['quarter-end']=colors['month-end'];
    const allText=text.map(t=>t.str).join(' ');
    for(const required of ['AM-Settled','Exception','Weeklys','End-of-Month','End-of-Quarter','LEAPS'])if(!allText.includes(required))throw Error('The calendar legend changed.');
    const leapsMatch=allText.match(/(20\d{2}) Equity and ETP LEAPS/);if(!leapsMatch)throw Error('Missing LEAPS listing year.');
    const colorTypes=new Map<string,ExpirationType>(legend.map((shape,i)=>[shape.color,legendTypes[i]]));
    // These two printed-cell inks differ from their own legend swatches in Cboe's 2026 PDF.
    if(colors['am-last-trade']==='#2ad870')colorTypes.set('#55ba6a','am-last-trade');
    if(colors['vix-last-trade']==='#69cbe2')colorTypes.set('#007481','vix-last-trade');
    const days:ExpirationCalendar['days']=[];
    for(const anchor of anchors){
      const numbers=text.filter(t=>/^\d{1,2}(?: \d{1,2})*$/.test(t.str.trim())&&t.transform[4]<legendX&&t.transform[5]<anchor.y-10&&anchors.filter(a=>a.y>t.transform[5]+10&&Math.abs(a.x-(t.transform[4]+Math.min(t.width,12)/2))<75).sort((a,b)=>(a.y-t.transform[5])-(b.y-t.transform[5])||Math.abs(a.x-t.transform[4])-Math.abs(b.x-t.transform[4]))[0]===anchor);
      const length=new Date(Date.UTC(year,anchor.month+1,0)).getUTCDate(),first=new Date(Date.UTC(year,anchor.month,1)).getUTCDay(),seen=new Set<number>(),xs:Point[]=[],ys:Point[]=[];
      for(const item of numbers){const tokens=item.str.trim().split(' ').map(Number),d=tokens[0],dow=new Date(Date.UTC(year,anchor.month,d)).getUTCDay();for(const token of tokens){if(token<1||token>length||seen.has(token))throw Error('Ambiguous calendar date.');seen.add(token);}xs.push([dow,item.transform[4]+item.height*.56*String(d).length/2]);ys.push([Math.floor((first+d-1)/7),item.transform[5]+item.height*.32]);}
      if(seen.size!==length)throw Error('Incomplete date grid.');const x=regression(xs),y=regression(ys);
      if(!(x.slope>12&&x.slope<22&&y.slope< -12&&y.slope> -25))throw Error('Unrecognised date-grid scale.');
      for(let day=1;day<=length;day++){
        const cx=x.origin+((first+day-1)%7)*x.slope,cy=y.origin+Math.floor((first+day-1)/7)*y.slope,near=shapes.filter(s=>s.box[0]<legendX&&Math.abs((s.box[0]+s.box[2])/2-cx)<12&&Math.abs((s.box[1]+s.box[3])/2-cy)<12),visible=new Set<string>();
        for(const dx of [-.34,-.2,0,.2,.34])for(const dy of [-.34,-.2,0,.2,.34]){const px=cx+dx*x.slope,py=cy+dy*(-y.slope);for(let j=near.length-1;j>=0;j--){if(contains(near[j],px,py)){visible.add(near[j].color);break;}}}
        const types:ExpirationType[]=[];
        for(const ink of visible){const type=colorTypes.get(ink);if(!type)throw Error('An unknown date-marker colour needs review.');if(!types.includes(type))types.push(type);}
        if(types.includes('month-end')&&[2,5,8,11].includes(anchor.month))types.push('quarter-end');
        days.push({date:`${year}-${String(anchor.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,types:types.sort()});
      }
    }
    for(const type of legendOrder){const count=days.filter(d=>d.types.includes(type)).length;if(!count||(['standard','am-last-trade','vix-last-trade','vix-standard','month-end'].includes(type)&&count!==12))throw Error(`Unverified ${type} coverage.`);}
    if(days.some(d=>d.types.includes('holiday')&&d.types.some(t=>['standard','am-last-trade','vix-standard','spx-weekly','month-end'].includes(t))))throw Error('Conflicting holiday markers.');
    return {year,days,colors,leapsYear:Number(leapsMatch[1]),source:{...source,sha256:createHash('sha256').update(bytes).digest('hex')}};
  }finally{await doc.destroy();}
}
