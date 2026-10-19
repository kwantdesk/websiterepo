// Defaults written by an ordinary settings save are still theme-linked.
// Only explicit colour-customization flags pin a colour across theme changes.
export function syncThemeSettings(current,fresh,{palette,light,timeZone}){
  current.lightMode=light;
  if(!current.backgroundIsCustomized)current.background=palette.background||fresh.background;
  for(const[key,value]of Object.entries(fresh)){
    if(value&&typeof value==='object'&&value.color&&!current[key]?.isCustomized)current[key]={...value,...current[key],color:value.color};
  }
  for(const series of Object.values(current.series||{})){
    if(!series||typeof series!=='object')continue;
    if(!series.isCustomized)delete series.color;
    if(!series.negativeIsCustomized)delete series.negativeColor;
  }
  if(!current.spotIsCustomized)current.spotColor=palette.foreground||fresh.spotColor;
  if(!current.timeZoneIsCustomized)current.timeZone=timeZone;
  return current;
}
