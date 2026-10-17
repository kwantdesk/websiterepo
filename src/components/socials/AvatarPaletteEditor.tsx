"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ChartColorField from "@/components/ChartColorField";
import definitions from "@/lib/socialAvatarPalettes.json";
import { normalizeAvatarColor, paletteEquals, recolorAvatarPixels, type AvatarAppearance, type PreparedAvatar } from "@/lib/avatarPalette";
import { encodeCanvasImage } from "@/lib/clientImageProcessing";
import { writeProtectedItem } from "@/lib/browserStorageQuota";
import { PREFERENCES_HYDRATED_EVENT } from "@/lib/userPreferences";

export type AvatarPaletteEditorHandle = { prepare: () => Promise<PreparedAvatar> };
type Pixels = { original: ImageData; map: ImageData };
type Definition = { colors: string[]; labels: string[]; map: string };
const palettes: Record<string, Definition> = definitions;
const RECENT_KEY = "olisa-recent-colors";
function readRecent() {
  try { const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(value) ? [...new Set(value.filter((c): c is string => typeof c === "string").map(normalizeAvatarColor).filter((c): c is string => !!c))].slice(0,12) : []; } catch { return []; }
}
function readPixels(url: string): Promise<ImageData> {
  return new Promise((resolve,reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => { image.onload=null; image.onerror=null; image.src=""; reject(new Error("Avatar colours could not load. Try again.")); },10000);
    image.onerror=()=>{clearTimeout(timer);reject(new Error("Avatar colours could not load. Try again."));};
    image.onload=()=>{
      clearTimeout(timer);
      try {
        if(image.naturalWidth!==500 || image.naturalHeight!==500) throw new Error("Avatar image has unexpected dimensions.");
        const canvas=document.createElement("canvas");canvas.width=500;canvas.height=500;
        const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("Image editing is unavailable in this browser.");
        context.imageSmoothingEnabled=false;context.drawImage(image,0,0);resolve(context.getImageData(0,0,500,500));
      } catch(error) {reject(error);}
    };
    image.src=url;
  });
}

const AvatarPaletteEditor = forwardRef<AvatarPaletteEditorHandle, {
  preset: { id: string; name: string; path: string; url: string };
  appearance?: AvatarAppearance; avatarUrl: string; disabled?: boolean;
}>(function AvatarPaletteEditor({preset,appearance,avatarUrl,disabled=false},ref) {
  const definition=palettes[preset.id];
  const initial=appearance?.presetId===preset.id && appearance.colors.length===definition.colors.length && appearance.colors.every(c=>normalizeAvatarColor(c)) ? appearance.colors : definition.colors;
  const [colors,setColors]=useState<string[]>(initial);
  const [recent,setRecent]=useState<string[]>([]);
  const [revision,setRevision]=useState(0);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const colorsRef=useRef(colors);colorsRef.current=colors;
  const pixelsRef=useRef<Pixels|null>(null);
  const loadRef=useRef<Promise<Pixels>|null>(null);
  const frameRef=useRef<ImageData|null>(null);
  const rafRef=useRef<number|null>(null);

  useEffect(()=>{
    const sync=()=>setRecent(readRecent());sync();
    window.addEventListener("storage",sync);window.addEventListener("kwantdesk:avatar-recent-colors",sync);window.addEventListener(PREFERENCES_HYDRATED_EVENT,sync);
    return()=>{window.removeEventListener("storage",sync);window.removeEventListener("kwantdesk:avatar-recent-colors",sync);window.removeEventListener(PREFERENCES_HYDRATED_EVENT,sync);};
  },[]);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");pixelsRef.current=null;frameRef.current=null;
    const promise=Promise.all([readPixels(preset.path),readPixels(definition.map)]).then(([original,map])=>({original,map}));loadRef.current=promise;
    void promise.then(pixels=>{if(active){pixelsRef.current=pixels;setLoading(false);setRevision(value=>value+1);}}).catch(reason=>{if(active){setLoading(false);setError(reason instanceof Error?reason.message:"Avatar could not load.");}});
    return()=>{active=false;if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};
  },[preset.id,preset.path,definition.map]);
  useEffect(()=>{
    if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(()=>{
      rafRef.current=null;const pixels=pixelsRef.current,canvas=canvasRef.current;if(!pixels||!canvas)return;
      try {
        const context=canvas.getContext("2d");if(!context)throw new Error("Image editing is unavailable.");
        const frame=frameRef.current??context.createImageData(500,500);frameRef.current=frame;
        recolorAvatarPixels(pixels.original.data,pixels.map.data,definition.colors,colorsRef.current,frame.data);context.putImageData(frame,0,0);
      }catch(reason){setError(reason instanceof Error?reason.message:"Avatar could not render.");}
    });
    return()=>{if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);};
  },[colors,revision,definition.colors]);

  const remember=(value:string)=>{
    const normalized=normalizeAvatarColor(value);if(!normalized)return;
    const next=[normalized,...readRecent().filter(c=>c!==normalized)].slice(0,12);setRecent(next);
    if(writeProtectedItem(RECENT_KEY,JSON.stringify(next)).ok){window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));window.dispatchEvent(new CustomEvent("kwantdesk:avatar-recent-colors"));}
  };
  const choose=(index:number,value:string)=>{const color=normalizeAvatarColor(value);if(!color||disabled)return;const next=colorsRef.current.map((old,i)=>i===index?color:old);colorsRef.current=next;setColors(next);};
  useImperativeHandle(ref,()=>({prepare:async()=>{
    const current=[...colorsRef.current];
    if(paletteEquals(current,definition.colors))return {avatarUrl:preset.url};
    const avatarAppearance:AvatarAppearance={version:1,presetId:preset.id,colors:current};
    if(paletteEquals(current,initial)&&appearance?.presetId===preset.id&&avatarUrl.startsWith("data:image/"))return {avatarUrl,avatarAppearance};
    const pixels=pixelsRef.current??await loadRef.current;if(!pixels)throw new Error("Avatar colours are still loading.");
    const canvas=document.createElement("canvas");canvas.width=500;canvas.height=500;const context=canvas.getContext("2d");if(!context)throw new Error("Image editing is unavailable.");
    const frame=context.createImageData(500,500);recolorAvatarPixels(pixels.original.data,pixels.map.data,definition.colors,current,frame.data);context.putImageData(frame,0,0);
    const prepared=await encodeCanvasImage(canvas,{maxBytes:350000,initialQuality:0.94,minimumQuality:0.78});return {avatarUrl:prepared.dataUrl,avatarAppearance};
  }}));

  return <section className="mt-4 border-t border-border pt-4" aria-label={`${preset.name} colour editor`}>
    <div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold">{preset.name} colours</h3><button type="button" disabled={disabled} onClick={()=>{const next=[...definition.colors];colorsRef.current=next;setColors(next);}} className="text-[9px] text-muted hover:text-primary disabled:opacity-40">Reset all</button></div>
    <div className="my-3 flex items-center gap-3">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-background ring-1 ring-border"><canvas ref={canvasRef} width={500} height={500} className="h-full w-full" aria-label="Live customised avatar preview" />{loading?<span className="absolute inset-0 flex items-center justify-center bg-panel/90 text-[9px] text-muted">Loading…</span>:null}</div>
      <p className="text-[9px] leading-4 text-muted">Updates live. Your colours are saved when you press Save Profile.</p>
    </div>
    <div className="mb-1 grid grid-cols-[minmax(56px,1fr)_38px_32px_90px] items-center gap-1 text-[7px] uppercase tracking-wide text-muted"><span>Colour</span><span>Yours</span><span>Stock</span><span>Recent</span></div>
    {definition.colors.map((stock,index)=><div key={index} className="grid grid-cols-[minmax(56px,1fr)_38px_32px_90px] items-center gap-1 border-t border-border/50 py-1.5">
      <span className="truncate text-[9px]">{definition.labels[index]}</span>
      <div className="[&>button]:w-8 [&>button]:justify-center [&>button]:p-0 [&>button>span:nth-child(2)]:hidden [&>button>svg]:hidden" onPointerUp={()=>remember(colorsRef.current[index])} onBlur={()=>remember(colorsRef.current[index])}><ChartColorField value={colors[index]} onChange={color=>choose(index,color)} disabled={disabled} ariaLabel={`Change ${definition.labels[index]}`} title={colors[index]} /></div>
      <button type="button" disabled={disabled} aria-label={`Reset ${definition.labels[index]} to ${stock}`} title={`Stock ${stock} — click to reset`} className="h-6 w-6 rounded border border-border disabled:opacity-40" style={{backgroundColor:stock}} onClick={()=>choose(index,stock)} />
      <div className="flex flex-wrap gap-1">{recent.slice(0,8).map(color=><button key={color} type="button" disabled={disabled} title={color} aria-label={`Use recent ${color} for ${definition.labels[index]}`} onClick={()=>{choose(index,color);remember(color);}} className="h-4 w-4 rounded-sm border border-border disabled:opacity-40" style={{backgroundColor:color}} />)}</div>
    </div>)}
    {error?<p role="alert" className="mt-2 text-[9px] text-danger">{error}</p>:null}
  </section>;
});
export default AvatarPaletteEditor;
