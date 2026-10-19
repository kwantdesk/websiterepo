import assert from "node:assert/strict";
import test from "node:test";
import {renderProfile,ProfilePathStub} from "./helpers/volume-profile-render-harness.mjs";
import {traceVolumeProfileContour,volumeProfileLevelFrontX} from "../src/lib/nativeVolumeProfilePrimitive.ts";
import {VOLUME_PROFILE_INDICATOR_IDS,defaultIndicatorSettings,normalizeStoredIndicator} from "../src/lib/chartIndicatorConfig.ts";

const modes=["volume","delta-volume","bid-ask","delta","delta-percentage"];
const styles=["automatic","solid","hollow","line","combined"];
// Actual renderer model shapes, not claims that every UI exposes every style.
const families=["daily","weekly","custom","custom-drawing"];
const expectedColours=mode=>mode==="volume"?["#5566FF"]:mode==="delta-volume"?["#5566FF","#22FF88","#FF2255"]:["#22FF88","#FF2255"];

test("all profile modes retain every selected component through every visual style, dock and axis direction",()=>{
  let checked=0;
  for(const family of families)for(const mode of modes)for(const visualStyle of styles)
    for(const snapMode of ["off","left","right"])for(const inverted of [false,true]){
      const label=[family,mode,visualStyle,snapMode,inverted].join("/");
      const {paths}=renderProfile({period:family==="daily"||family==="weekly"?family:"custom",drawing:family==="custom-drawing",mode,visualStyle,snapMode,inverted});
      const colours=new Set(paths.map(p=>p.color));
      for(const colour of expectedColours(mode))assert.ok(colours.has(colour),label+" missing "+colour);
      if(mode==="delta"||mode==="delta-percentage"||mode==="bid-ask")assert.ok(!colours.has("#5566FF"),label+" invented volume silhouette");
      if(visualStyle==="line"){
        assert.ok(paths.every(p=>p.kind==="stroke"),label+" filled an interior");
        assert.ok(paths.every(p=>p.commands.every(c=>c[0]!=="rect")),label+" outlined row boxes instead of contours");
      }
      checked++;
    }
  assert.equal(checked,600);
});

test("every configurable profile family preserves mode and appearance independently when saved",()=>{
  for(const indicatorId of VOLUME_PROFILE_INDICATOR_IDS)for(const profileMode of modes)for(const visualStyle of styles){
    const stored=normalizeStoredIndicator({instanceId:indicatorId,indicatorId,enabled:true,
      settings:{...defaultIndicatorSettings(indicatorId),profileMode,visualStyle,showDelta:true}});
    assert.equal(stored.settings.profileMode,profileMode,indicatorId);
    assert.equal(stored.settings.visualStyle,visualStyle,indicatorId);
    assert.equal(stored.settings.showDelta,true,indicatorId);
  }
});

test("Line component edges use exactly the corresponding solid row bounds",()=>{
  for(const family of families)for(const mode of modes)for(const snapMode of ["off","left","right"])for(const inverted of [false,true]){
    const options={period:family==="daily"||family==="weekly"?family:"custom",drawing:family==="custom-drawing",mode,snapMode,inverted};
    const solid=renderProfile({...options,visualStyle:"solid"}).paths;
    const line=renderProfile({...options,visualStyle:"line"}).paths;
    for(const colour of expectedColours(mode)){
      const rects=solid.filter(p=>p.color===colour||(colour==="#5566FF"&&p.color==="#334455")).flatMap(p=>p.commands).filter(c=>c[0]==="rect");
      const points=line.filter(p=>p.color===colour).flatMap(p=>p.commands);
      for(const [,x,y,width,height] of rects){
        // Each rectangle contributes both ends of its outer vertical edge.
        const matches=edge=>[y,y+height].every(yy=>points.some(c=>Math.abs(c[1]-edge)<1e-6&&Math.abs(c[2]-yy)<1e-6));
        assert.ok(matches(x)||matches(x+width),[family,mode,snapMode,inverted,colour].join("/"));
      }
    }
  }
});

test("gradient colours preserve all contours and showDelta/zero-delta never create or erase the wrong component",()=>{
  for(const mode of modes)for(const visualStyle of styles)for(const snapMode of ["off","left","right"]){
    const plain=renderProfile({mode,visualStyle,snapMode}).paths;
    const gradient=renderProfile({mode,visualStyle,snapMode,gradient:{from:"#FF0000",to:"#48FF03"}}).paths;
    assert.equal(gradient.length,plain.length,[mode,visualStyle,snapMode].join("/"));
    const zero=renderProfile({mode,visualStyle,snapMode,zeroDelta:true}).paths;
    if(mode!=="bid-ask")assert.ok(zero.every(p=>p.color!=="#22FF88"&&p.color!=="#FF2255"),"zero delta has phantom marks");
    const hidden=renderProfile({mode,visualStyle,snapMode,showDelta:false}).paths;
    if(mode!=="bid-ask")assert.ok(hidden.every(p=>p.color!=="#22FF88"&&p.color!=="#FF2255"));
    if(mode==="delta-volume")assert.ok(hidden.some(p=>p.color==="#5566FF"));
  }
});

test("contours split at missing rows or direction changes and never bridge empty price ranges",()=>{
  const path=new ProfilePathStub();
  traceVolumeProfileContour(path,[
    {row:0,x:100,y:10,width:20,height:10,side:"right"},
    {row:1,x:100,y:20,width:35,height:10,side:"right"},
    {row:3,x:100,y:40,width:15,height:10,side:"right"},
    {row:4,x:80,y:50,width:20,height:10,side:"left"},
    {row:5,x:80,y:100,width:20,height:10,side:"left"},
  ]);
  assert.equal(path.commands.filter(c=>c[0]==="move").length,4);
  assert.ok(path.commands.every(c=>c.slice(1).every(Number.isFinite)));
});

test("VAH/VAL/POC attachment follows the selected mode, independent of appearance",()=>{
  for(const mode of modes)for(const pinned of [false,true])for(const splitPinnedDaily of [false,true])for(const facesLeft of [false,true]){
    const input={anchorX:100,facesLeft,pinned,splitPinnedDaily,mode,deltaOnRight:true,volumeWidth:90,deltaWidth:35,askWidth:70,bidWidth:20};
    const expected=volumeProfileLevelFrontX({...input,visualStyle:"solid"});
    for(const visualStyle of styles)assert.equal(volumeProfileLevelFrontX({...input,visualStyle}),expected);
  }
});
