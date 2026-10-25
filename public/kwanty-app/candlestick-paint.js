// Match the standard Charts Lightweight Charts candle width/parity policy.
// Geometry is rounded in device pixels, not CSS pixels, so wicks stay sharp at
// fractional browser zoom/DPI. Bodies are square; profile bars remain unrelated.
export function candleBodyWidth(spacing,ratio=1){
 const minimum=Math.max(1,Math.floor(ratio));
 let width=spacing>=2.5&&spacing<=4?Math.floor(3*ratio):Math.max(minimum,Math.min(Math.floor(spacing*(1-.2*Math.atan(Math.max(4,spacing)-4)/(Math.PI*.5))*ratio),Math.floor(spacing*ratio)));
 if(width>=2&&width%2!==minimum%2)width--;
 return Math.max(1,width);
}
export function paintCandlestick(ctx,{x,openY,highY,lowY,closeY,spacing,color}){
 if(![x,openY,highY,lowY,closeY,spacing].every(Number.isFinite)||spacing<=0||highY>Math.min(openY,closeY)||lowY<Math.max(openY,closeY))return null;
 const transform=ctx.getTransform?.(),rx=Number.isFinite(transform?.a)&&transform.a>0?transform.a:1,ry=Number.isFinite(transform?.d)&&transform.d>0?transform.d:rx;
 const width=candleBodyWidth(spacing,rx),wickWidth=Math.max(1,Math.floor(rx)),center=Math.round(x*rx);
 const top=Math.round(Math.min(openY,closeY)*ry),bottom=Math.round(Math.max(openY,closeY)*ry),high=Math.round(highY*ry),low=Math.round(lowY*ry);
 const body={x:center-Math.floor(width/2),y:top,width,height:bottom-top+1};
 const upper={x:center-Math.floor(wickWidth/2),y:high,width:wickWidth,height:top-high};
 const lower={x:upper.x,y:bottom+1,width:wickWidth,height:low-bottom};
 ctx.fillStyle=color;
 for(const rect of [upper,lower,body])if(rect.height>0)ctx.fillRect(rect.x/rx,rect.y/ry,rect.width/rx,rect.height/ry);
 return {body,upper,lower,pixelRatioX:rx,pixelRatioY:ry};
}
