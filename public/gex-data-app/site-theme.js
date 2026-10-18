const defaults={background:'#000000',panel:'#080808',surface:'#151515',foreground:'#FFFFFF',muted:'#777777',border:'#333333',primary:'#FFFFFF',accent:'#9A9A9A',danger:'#6B6B6B',warning:'#D6B45F',bullish:'#FFFFFF',bearish:'#777777'};
let palette={...defaults};
function channels(color){
  if(color==='white')return[255,255,255,1];if(color==='black')return[0,0,0,1];
  if(color[0]==='#'){let hex=color.slice(1);if(hex.length===3||hex.length===4)hex=[...hex].map(c=>c+c).join('');return[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),hex.length===8?parseInt(hex.slice(6,8),16)/255:1];}
  const numbers=color.match(/[\d.]+/g)?.map(Number);if(!numbers)return null;
  if(color.startsWith('rgb'))return[numbers[0],numbers[1],numbers[2],numbers[3]??1];
  if(color.startsWith('hsl')){const[h,s,l]=[numbers[0]/360,numbers[1]/100,numbers[2]/100],a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return 255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)));};return[f(0),f(8),f(4),numbers[3]??1];}return null;
}
export function themeRole(color){
  const rgb=channels(color);if(!rgb)return'primary';const[r,g,b]=rgb,max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/510;
  if(light<.045)return'background';if(light<.085)return'panel';if(light<.13)return'surface';if(light<.23)return'border';
  if(light>.84)return'foreground';if(max-min<35)return light>.55?'muted':'border';
  const hue=((max===r?(g-b)/(max-min)+(g<b?6:0):max===g?(b-r)/(max-min)+2:(r-g)/(max-min)+4)*60);
  if(hue<25||hue>340)return'bearish';if(hue<75)return'warning';if(hue<170)return'bullish';if(hue<245)return'accent';return light>.68?'accent':'primary';
}
export function themePaint(color){
  if(typeof document==='undefined')return color;
  const mapped=palette[themeRole(color)]||palette.primary,alpha=channels(color)?.[3]??1;
  if(alpha>=1)return mapped;const rgb=channels(mapped);return rgb?`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`:mapped;
}
export async function installTheme(next){
  palette={...defaults,...next};if(typeof document==='undefined')return;
  const colors=await fetch(new URL('./site-colors.json',import.meta.url)).then(r=>r.json());
  for(const color of colors){const suffix=[...new TextEncoder().encode(color)].map(n=>n.toString(16).padStart(2,'0')).join('');document.documentElement.style.setProperty('--gex-'+suffix,themePaint(color));}
  for(const[key,value]of Object.entries(palette))document.documentElement.style.setProperty('--site-'+key,value);
  const background=channels(palette.background)||[0,0,0];document.documentElement.style.colorScheme=(Math.max(...background.slice(0,3))+Math.min(...background.slice(0,3)))<255?'dark':'light';
}
