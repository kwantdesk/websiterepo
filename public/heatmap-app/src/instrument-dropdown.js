/** Nonmodal instrument menu shared by every liquidity-map surface. */
export function openInstrumentDropdown(picker, anchor) {
  if(picker.open){picker.close();return;}
  const doc=picker.ownerDocument,win=doc.defaultView;
  win.dispatchEvent(new CustomEvent('kwantdesk:liquidity-instrument-menu'));
  const visible=element=>element&&element.getBoundingClientRect().width>0&&element.getBoundingClientRect().height>0&&!element.closest('.kwant-embed-phone-drawer');
  const trigger=[anchor,doc.querySelector('#newTab'),doc.querySelector('.instrument-tab[aria-selected=true]'),doc.querySelector('.kwant-embed-phone-toggle')].find(visible);
  const position=()=>{
    const rect=trigger?.getBoundingClientRect()??{left:8,top:0,bottom:38},gap=6,margin=8;
    const width=Math.min(340,Math.max(0,win.innerWidth-margin*2)),below=win.innerHeight-rect.bottom-gap-margin,above=rect.top-gap-margin;
    const up=below<180&&above>below,height=Math.min(360,Math.max(0,up?above:below));
    Object.assign(picker.style,{left:Math.max(margin,Math.min(rect.left,win.innerWidth-width-margin))+'px',top:(up?Math.max(margin,rect.top-gap-height):Math.max(margin,rect.bottom+gap))+'px',width:width+'px',height:height+'px'});
  };
  const outside=event=>{if(!picker.contains(event.target)&&!trigger?.contains(event.target))picker.close();};
  const escape=event=>{if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();picker.close();trigger?.focus();};
  const scroll=event=>{if(!picker.contains(event.target))position();};
  const cleanup=()=>{trigger?.setAttribute('aria-expanded','false');doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);win.removeEventListener('resize',position);win.removeEventListener('scroll',scroll,true);};
  picker.show();position();trigger?.setAttribute('aria-expanded','true');
  doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);win.addEventListener('resize',position);win.addEventListener('scroll',scroll,true);picker.addEventListener('close',cleanup,{once:true});
}
