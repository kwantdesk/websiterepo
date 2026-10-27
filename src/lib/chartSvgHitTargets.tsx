import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { DRAWING_HIT_SLOP } from './drawingPaintedHit';

/** Mirror painted SVG paths, never the drawing's bounding rectangle. */
export function chartSvgHitTargets(body:ReactNode, allowFills=false, interactive=true):ReactNode {
  return Children.map(body,child=>{
    if(!isValidElement(child))return null;
    const element=child as ReactElement<Record<string,unknown>>;
    const p=element.props,type=element.type;
    if (Number(p.opacity ?? 1) <= 0) return null;
    if(typeof type!=='string') return p.children?chartSvgHitTargets(p.children as ReactNode,allowFills,interactive):null;
    if(type==='g')return cloneElement(element,{style:{pointerEvents:'none'},children:chartSvgHitTargets(p.children as ReactNode,allowFills,interactive)});
    if(type==='text')return cloneElement(element,{fill:'transparent',stroke:'none',opacity:1,style:{pointerEvents:interactive?'bounding-box':'none'},'data-painted-hit':'text'});
    if(!['line','polyline','path','rect','circle','ellipse','polygon'].includes(type))return null;
    const stroked=p.stroke!==undefined && p.stroke!=='none' && p.stroke!=='transparent' && Number(p.strokeOpacity??1)>0;
    const filled=allowFills && p.fill!==undefined && p.fill!=='none' && p.fill!=='transparent' && Number(p.fillOpacity??1)>0;
    if(!stroked&&!filled)return null;
    return cloneElement(element,{
      fill:filled?'transparent':'none',fillOpacity:1,stroke:stroked?'transparent':'none',strokeOpacity:1,
      strokeWidth:stroked?Math.max(1,Number(p.strokeWidth??1))+DRAWING_HIT_SLOP*2:0,
      opacity:1,style:{pointerEvents:interactive?(filled?'all':'stroke'):'none'},'data-painted-hit':'shape','data-hit-fill':filled?'true':undefined,
    });
  });
}

/** Same targets serve erasing, clipboard selection and drag interception. */
export function chartSvgBodyHit(root:SVGSVGElement|null,id:string,x:number,y:number) {
  if(!root)return false;
  const group=Array.from(root.querySelectorAll<SVGGElement>('[data-chart-drawing-id]')).find(g=>g.dataset.chartDrawingId===id);
  const matrix=root.getScreenCTM();if(!group||!matrix)return false;
  const screen=new DOMPoint(x,y).matrixTransform(matrix);
  for(const element of group.querySelectorAll<SVGGraphicsElement>('[data-painted-hit]')) {
    if(element.dataset.paintedHit==='text'){
      const box=element.getBoundingClientRect();
      if(screen.x>=box.left&&screen.x<=box.right&&screen.y>=box.top&&screen.y<=box.bottom)return true;
      continue;
    }
    const transform=element.getScreenCTM();if(!transform)continue;
    const local=screen.matrixTransform(transform.inverse());
    const geometry=element as SVGGeometryElement;
    if(geometry.isPointInStroke(local)||(element.dataset.hitFill==='true'&&geometry.isPointInFill(local)))return true;
  }
  return false;
}
