import fs from "node:fs";
import sharp from "sharp";
import { recolorAvatarPixels } from "../src/lib/avatarPalette.ts";
const definitions=JSON.parse(fs.readFileSync("src/lib/socialAvatarPalettes.json","utf8"));
const ids=["robot","fox","ghost","frog","toaster","owl"];
const layers=[];
for(let i=0;i<ids.length;i++){
  const id=ids[i],definition=definitions[id];
  const original=await sharp(`public/images/avatars/console-v1/${id}.webp`).ensureAlpha().raw().toBuffer();
  const map=await sharp(`public${definition.map}`).ensureAlpha().raw().toBuffer();
  const selected=definition.colors.map((_,index)=>["#4AE0DC","#191B30","#FF5599","#FFF2B1","#AA82FF","#7BFD79","#E0A888"][index%7]);
  const recolored=recolorAvatarPixels(new Uint8ClampedArray(original),new Uint8ClampedArray(map),definition.colors,selected);
  for(const [column,buffer] of [original,recolored].entries()){
    const tile=await sharp(buffer,{raw:{width:500,height:500,channels:4}}).resize(120,120).composite([{input:Buffer.from('<svg width="120" height="120"><circle cx="60" cy="60" r="59" fill="white"/></svg>'),blend:"dest-in"}]).png().toBuffer();
    layers.push({input:tile,left:20+column*160,top:40+i*150});
  }
  const labels=Buffer.from(`<svg width="340" height="22"><text x="80" y="16" fill="#eeeeee" font-family="Arial" font-size="12" text-anchor="middle">${id}: stock</text><text x="240" y="16" fill="#eeeeee" font-family="Arial" font-size="12" text-anchor="middle">custom</text></svg>`);
  layers.push({input:labels,left:0,top:18+i*150});
}
await sharp({create:{width:340,height:950,channels:4,background:"#10141d"}}).composite(layers).webp({quality:90}).toFile("docs/avatar-art/console-colours-review.webp");
