import fs from "node:fs";
import sharp from "sharp";
const ids = fs.readdirSync("public/images/avatars/console-v1").filter(p => p.endsWith(".webp")).map(p => p.slice(0, -5)).sort();
const directory = "public/images/avatars/console-colour-maps-v1";
fs.mkdirSync(directory, { recursive: true });
const hex = rgb => "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const distance = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
const result = {};
for (const id of ids) {
  const { data, info } = await sharp(`public/images/avatars/console-v1/${id}.webp`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const size = info.width * info.height;
  const background = [0, 0, 0]; let cornerCount = 0;
  for (let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if ((x<8 || x>=info.width-8) && (y<8 || y>=info.height-8)) { for(let c=0;c<3;c++) background[c] += data[(y*info.width+x)*3+c]; cornerCount++; }
  for(let c=0;c<3;c++) background[c] /= cornerCount;
  const bg = new Uint8Array(size), queue = new Int32Array(size); let head=0, tail=0;
  const enqueue = p => { if(bg[p]) return; const i=p*3; if((data[i]-background[0])**2+(data[i+1]-background[1])**2+(data[i+2]-background[2])**2>400) return; bg[p]=1;queue[tail++]=p; };
  for(let x=0;x<info.width;x++){enqueue(x);enqueue((info.height-1)*info.width+x);}
  for(let y=0;y<info.height;y++){enqueue(y*info.width);enqueue(y*info.width+info.width-1);}
  while(head<tail){const p=queue[head++], x=p%info.width;if(x)enqueue(p-1);if(x<info.width-1)enqueue(p+1);if(p>=info.width)enqueue(p-info.width);if(p<size-info.width)enqueue(p+info.width);}
  const histogram = new Map();
  for(let p=0;p<size;p++)if(!bg[p]){const i=p*3,key=((data[i]>>3)<<10)|((data[i+1]>>3)<<5)|(data[i+2]>>3);let point=histogram.get(key);if(!point){point={rgb:[0,0,0],count:0};histogram.set(key,point);}point.count++;for(let c=0;c<3;c++)point.rgb[c]+=data[i+c];}
  const points=[...histogram.values()].map(p=>({rgb:p.rgb.map(v=>v/p.count),count:p.count})).sort((a,b)=>b.count-a.count);
  let centers=[points[0].rgb];
  while(centers.length<9){let best=null,score=0;for(const point of points){const d=Math.min(...centers.map(c=>distance(c,point.rgb)));const s=d*Math.sqrt(point.count);if(d>1600 && s>score){score=s;best=point;}}if(!best)break;centers.push(best.rgb);}
  let weights=[];
  for(let step=0;step<12;step++){const sums=centers.map(()=>[0,0,0,0]);for(const point of points){let at=0,d=Infinity;for(let j=0;j<centers.length;j++){const next=distance(point.rgb,centers[j]);if(next<d){d=next;at=j;}}const sum=sums[at];sum[3]+=point.count;for(let c=0;c<3;c++)sum[c]+=point.rgb[c]*point.count;}weights=sums.map(s=>s[3]);centers=sums.map((s,i)=>s[3]?s.slice(0,3).map(v=>v/s[3]):centers[i]);}
  let clusters=centers.map((rgb,i)=>({rgb,count:weights[i]})).filter(p=>p.count>size*0.0015).sort((a,b)=>b.count-a.count);
  for(let i=0;i<clusters.length;i++)for(let j=clusters.length-1;j>i;j--)if(distance(clusters[i].rgb,clusters[j].rgb)<2500){const a=clusters[i],b=clusters[j],count=a.count+b.count;a.rgb=a.rgb.map((v,c)=>(v*a.count+b.rgb[c]*b.count)/count);a.count=count;clusters.splice(j,1);}
  // Antialiased boundary colours aren't separate paint regions. Keep genuine
  // low-area accents, but fold small mixtures back into their two base colours.
  clusters=clusters.filter((point,index,all)=>{
    if(point.count>size*0.04)return true;
    const others=all.filter((_,i)=>i!==index).map(p=>p.rgb);
    for(let a=0;a<others.length;a++)for(let b=a+1;b<others.length;b++){const u=others[a],v=others[b],vector=v.map((x,c)=>x-u[c]),den=distance(u,v);const t=Math.max(0,Math.min(1,point.rgb.reduce((s,x,c)=>s+(x-u[c])*vector[c],0)/den));if(t>0.08&&t<0.92&&distance(point.rgb,u.map((x,c)=>x+t*vector[c]))<225)return false;}
    return true;
  });
  const dark=clusters.reduce((best,p,i)=>p.rgb.reduce((a,b)=>a+b,0)<clusters[best].rgb.reduce((a,b)=>a+b,0)?i:best,0);
  const outline=clusters.splice(dark,1)[0];
  const palette=[background,outline.rgb,...clusters.map(p=>p.rgb)].map(rgb=>rgb.map(Math.round));
  const names=palette.map((_,i)=>i===0?"Background":i===1?"Outline":`Colour ${i-1}`);
  const mask=Buffer.alloc(size*3);
  for(let p=0;p<size;p++){
    const i=p*3, rgb=[data[i],data[i+1],data[i+2]];
    if(bg[p])continue;
    let a=0,b=0,mix=0,error=Infinity;
    for(let j=0;j<palette.length;j++){const d=distance(rgb,palette[j]);if(d<error){error=d;a=j;b=j;}}
    if(error>100)for(let j=0;j<palette.length;j++)for(let k=j+1;k<palette.length;k++){
      const u=palette[j],v=palette[k],d=distance(u,v);if(!d)continue;
      const t=Math.max(0,Math.min(1,((rgb[0]-u[0])*(v[0]-u[0])+(rgb[1]-u[1])*(v[1]-u[1])+(rgb[2]-u[2])*(v[2]-u[2]))/d));
      const e=distance(rgb,u.map((x,c)=>x+(v[c]-x)*t));if(e<error){error=e;a=j;b=k;mix=t;}
    }
    mask[i]=a;mask[i+1]=b;mask[i+2]=Math.round(mix*255);
  }
  await sharp(mask,{raw:{width:info.width,height:info.height,channels:3}}).png({compressionLevel:9}).toFile(`${directory}/${id}.png`);
  result[id]={colors:palette.map(hex),labels:names,map:`/images/avatars/console-colour-maps-v1/${id}.png`};
  console.log(id,palette.length,palette.map(hex).join(" "));
}
fs.writeFileSync("src/lib/socialAvatarPalettes.json",JSON.stringify(result,null,2)+"\n");
