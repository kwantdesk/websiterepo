// Defaults written by an ordinary settings save are still theme-linked.
// Only explicit colour-customization flags pin a colour across theme changes.
export function syncThemeSettings(current,fresh,{palette,light,timeZone}){
  current.lightMode=light;
  if(!current.backgroundIsCustomized)current.background=palette.background||fresh.background;
  for(const[key,value]of Object.entries(fresh)){
    if(value&&typeof value==='object'&&value.color&&!current[key]?.isCustomized)current[key]={...value,...current[key],color:value.color};
  }
  // Older profile workspaces used these aliases before candleUp/candleDown.
  // Their saved default colours must not override the theme-linked candle pair.
  for(const[key,fallback]of [['spot_candle_up','candleUp'],['spot_candle_down','candleDown']]){
    if(current[key]&&typeof current[key]==='object'&&!current[key].isCustomized&&fresh[fallback]?.color)current[key]={...current[key],color:fresh[fallback].color};
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

export function useThemeColour(settings,key){
  if(key.startsWith('series:')){
    const[,field,sign]=key.split(':'),series=settings.series?.[field];if(!series)return;
    delete series[sign==='positive'?'isCustomized':'negativeIsCustomized'];
    delete series[sign==='positive'?'color':'negativeColor'];return;
  }
  if(key==='background'){delete settings.backgroundIsCustomized;delete settings.background;return;}
  if(key==='spotColor'){delete settings.spotIsCustomized;delete settings.spotColor;return;}
  if(settings[key]&&typeof settings[key]==='object'){delete settings[key].isCustomized;delete settings[key].color;}
}
