/** All distances are CSS pixels, independent of price, tick size and device DPI. */
export const DRAWING_HIT_SLOP = 2;
export const DRAWING_HANDLE_HIT_RADIUS = 6;
export type HitPoint = { x: number; y: number };
export type PaintedHitShape = { points: HitPoint[]; closed?: boolean; filled?: boolean; width: number; dash?: number[] };

export function segmentDistance(p: HitPoint, a: HitPoint, b: HitPoint) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
  return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
}
export function pointHitsPaintedShape(point: HitPoint, shape: PaintedHitShape, slop = DRAWING_HIT_SLOP) {
  if (![point.x, point.y, ...shape.points.flatMap(p => [p.x,p.y])].every(Number.isFinite)) return false;
  const limit = Math.max(0, shape.width)/2 + slop;
  let offset=0;
  for (let i=1; i<shape.points.length; i++) {
    const a=shape.points[i-1],b=shape.points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    const pattern=(shape.dash??[]).filter(n=>Number.isFinite(n)&&n>0);
    if(pattern.length%2)pattern.push(...pattern);
    if(!pattern.length){if(segmentDistance(point,a,b)<=limit)return true;}
    else {
      const period=pattern.reduce((sum,n)=>sum+n,0);let phase=offset%period,index=0;
      while(phase>=pattern[index]){phase-=pattern[index];index=(index+1)%pattern.length;}
      for(let at=0;at<length;){const step=Math.min(length-at,pattern[index]-phase);
        if(index%2===0&&length>0&&segmentDistance(point,{x:a.x+(b.x-a.x)*at/length,y:a.y+(b.y-a.y)*at/length},{x:a.x+(b.x-a.x)*(at+step)/length,y:a.y+(b.y-a.y)*(at+step)/length})<=limit)return true;
        at+=step;phase=0;index=(index+1)%pattern.length;
      }
    }
    offset+=length;
  }
  if (shape.closed && shape.points.length>2) {
    if (segmentDistance(point,shape.points.at(-1)!,shape.points[0]) <= limit) return true;
    if (shape.filled) {
      let inside=false;
      for(let i=0,j=shape.points.length-1;i<shape.points.length;j=i++) {
        const a=shape.points[i],b=shape.points[j];
        if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
      }
      if(inside)return true;
    }
  }
  return false;
}
export function rectangleHitShape(x:number,y:number,width:number,height:number,lineWidth=1,filled=false):PaintedHitShape {
  return { points:[{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}],closed:true,filled,width:lineWidth };
}
export function ellipseHitShape(cx:number,cy:number,rx:number,ry:number,rotation=0,start=0,end=Math.PI*2,ccw=false,width=1):PaintedHitShape {
  const tau=Math.PI*2;
  let span=end-start;
  if(Math.abs(span)>=tau)span=ccw?-tau:tau;
  else if(ccw&&span>0)span-=tau;
  else if(!ccw&&span<0)span+=tau;
  const count=Math.max(12,Math.min(512,Math.ceil(Math.max(rx,ry)*Math.abs(span)/6)));
  return { width,points:Array.from({length:count+1},(_,i)=>{
    const a=start+span*i/count,x=rx*Math.cos(a),y=ry*Math.sin(a);
    return {x:cx+x*Math.cos(rotation)-y*Math.sin(rotation),y:cy+x*Math.sin(rotation)+y*Math.cos(rotation)};
  }) };
}

let measurement: CanvasRenderingContext2D | null | undefined;
export function drawingTextWidth(text:string,font:string) {
  if (measurement === undefined) {
    measurement = typeof document !== 'undefined' && typeof document.createElement === 'function'
      ? document.createElement('canvas').getContext('2d') : null;
  }
  if(measurement){measurement.font=font;return measurement.measureText(text).width;}
  const size=Number(font.match(/([\d.]+)px/)?.[1])||12;
  return text.length*size*.6;
}

/** Run the real canvas painter against a geometry collector. Nothing is drawn
 * and no data is fetched. Labels and analytical curves use the painter's own
 * coordinates, rather than a second approximation of its anchor rectangle. */
export function paintedHitContext(allowBodyFills=false) {
  const shapes:PaintedHitShape[]=[];
  let paths:HitPoint[][]=[],current:HitPoint[]=[];
  const stack:Array<Record<string,unknown>>=[];
  const state:Record<string,unknown>={lineWidth:1,globalAlpha:1,strokeStyle:'#000',fillStyle:'#000',font:'12px Aleph',textAlign:'left',textBaseline:'alphabetic',dash:[],transform:[1,0,0,1,0,0]};
  const visible=(kind:'strokeStyle'|'fillStyle')=>Number(state.globalAlpha)>0 && !['transparent','none','rgba(0,0,0,0)'].includes(String(state[kind]).replaceAll(' ',''));
  const add=(shape:PaintedHitShape)=>{
    const m=state.transform as number[];
    shapes.push({...shape,points:shape.points.map(p=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}))});
  };
  const api={
    translate(x:number,y:number){const m=state.transform as number[];state.transform=[...m.slice(0,4),m[4]+m[0]*x+m[2]*y,m[5]+m[1]*x+m[3]*y]},
    rotate(angle:number){const m=state.transform as number[],c=Math.cos(angle),s=Math.sin(angle);state.transform=[m[0]*c+m[2]*s,m[1]*c+m[3]*s,m[2]*c-m[0]*s,m[3]*c-m[1]*s,m[4],m[5]]},
    save(){stack.push({...state})},restore(){Object.assign(state,stack.pop()??{})},
    beginPath(){paths=[];current=[]},moveTo(x:number,y:number){current=[{x,y}];paths.push(current)},
    lineTo(x:number,y:number){if(!current.length){current=[];paths.push(current)}current.push({x,y})},
    rect(x:number,y:number,w:number,h:number){const shape=rectangleHitShape(x,y,w,h);current=[...shape.points,shape.points[0]];paths.push(current)},
    ellipse(cx:number,cy:number,rx:number,ry:number,rotation:number,start:number,end:number,ccw=false){current=ellipseHitShape(cx,cy,rx,ry,rotation,start,end,ccw).points;paths.push(current)},
    closePath(){if(current.length)current.push({...current[0]})},
    arc(cx:number,cy:number,r:number,start:number,end:number,ccw=false){const arc=ellipseHitShape(cx,cy,r,r,0,start,end,ccw).points;if(current.length)current.push(...arc);else {current=arc;paths.push(current)}},
    roundRect(x:number,y:number,w:number,h:number,radius:number|number[]){
      const r=Math.min(Math.abs(w)/2,Math.abs(h)/2,Array.isArray(radius)?radius[0]:radius);
      const left=Math.min(x,x+w),top=Math.min(y,y+h),right=left+Math.abs(w),bottom=top+Math.abs(h);
      current=[];paths.push(current);
      for(const [cx,cy,start] of [[right-r,top+r,-Math.PI/2],[right-r,bottom-r,0],[left+r,bottom-r,Math.PI/2],[left+r,top+r,Math.PI]])current.push(...ellipseHitShape(cx,cy,r,r,0,start,start+Math.PI/2).points);
      if(current.length)current.push({...current[0]});
    },
    bezierCurveTo(x1:number,y1:number,x2:number,y2:number,x:number,y:number){
      const a=current.at(-1)??{x:0,y:0},length=Math.hypot(x1-a.x,y1-a.y)+Math.hypot(x2-x1,y2-y1)+Math.hypot(x-x2,y-y2),steps=Math.max(12,Math.min(1024,Math.ceil(length/3)));
      for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;current.push({x:u*u*u*a.x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x,y:u*u*u*a.y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y})}
    },
    quadraticCurveTo(cx:number,cy:number,x:number,y:number){const a=current.at(-1)??{x:0,y:0};api.bezierCurveTo(a.x+2*(cx-a.x)/3,a.y+2*(cy-a.y)/3,x+2*(cx-x)/3,y+2*(cy-y)/3,x,y)},
    stroke(){if(visible('strokeStyle'))for(const points of paths)add({points:[...points],width:Number(state.lineWidth),dash:state.dash as number[]})},
    fill(){if(allowBodyFills&&visible('fillStyle'))for(const points of paths)add({points:[...points],closed:true,filled:true,width:0})},
    fillRect(x:number,y:number,w:number,h:number){if(allowBodyFills&&visible('fillStyle'))add(rectangleHitShape(x,y,w,h,0,true))},
    strokeRect(x:number,y:number,w:number,h:number){if(visible('strokeStyle'))add(rectangleHitShape(x,y,w,h,Number(state.lineWidth)))},
    measureText(text:string){return {width:drawingTextWidth(text,String(state.font))}},
    fillText(text:string,x:number,y:number){
      if(!visible('fillStyle'))return;
      const width=drawingTextWidth(text,String(state.font)),size=Number(String(state.font).match(/([\d.]+)px/)?.[1])||12;
      const left=state.textAlign==='right'||state.textAlign==='end'?x-width:state.textAlign==='center'?x-width/2:x;
      const top=state.textBaseline==='middle'?y-size/2:state.textBaseline==='top'?y:y-size;
      add(rectangleHitShape(left,top,width,size,0,true));
    },setLineDash(dash:number[]){state.dash=[...dash]},clearRect(){},
  };
  const context=new Proxy(api as unknown as CanvasRenderingContext2D,{
    get(target,key){return key in target?Reflect.get(target,key):state[String(key)]},
    set(_target,key,value){state[String(key)]=value;return true},
  });
  return {context,shapes};
}
