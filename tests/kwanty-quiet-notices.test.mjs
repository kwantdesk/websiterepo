import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("public/kwanty-app/app.js");

test("provider/history notices are hidden before startup and never announce",()=>{
  const html=read("public/kwanty-app/index.html");
  assert.doesNotMatch(html,/id="historyNotice"/);
  for(const id of ["connection","freshnessDetails"]){
    const tag=html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0];
    assert.ok(tag,id);assert.match(tag,/ hidden data-kwanty-diagnostic/);
    assert.doesNotMatch(tag,/role=|aria-live/);
    assert.doesNotMatch(app,new RegExp(`\\$\\('#${id}'\\)\\.hidden\\s*=\\s*false`));
  }
  assert.doesNotMatch(html,/Checking provider|No full-session history loaded/);
  assert.match(read("public/kwanty-app/site.css"),/\[data-kwanty-diagnostic\]\{display:none!important\}/);
});

test("health updates preserve diagnostics without making them visible",()=>{
  const elements=Object.fromEntries(["connection","freshnessDetails"].map(id=>[id,{hidden:true,textContent:"",className:"",classList:{toggle(){}}}]));
  const state={sourceError:null,envelope:null,authenticated:false,historyMode:false,records:[],auto:true,replayIndex:null,historyError:null};
  const context={state,$:selector=>elements[selector.slice(1)],Date};
  vm.runInNewContext(app.slice(app.indexOf("function updateHealth()"),app.indexOf("function updateLabels()"))+";globalThis.update=updateHealth;",context);
  context.update();assert.match(elements.connection.textContent,/Checking provider/);
  state.sourceError="UPSTREAM_ENTITLEMENT_REQUIRED";context.update();assert.match(elements.connection.textContent,/UNAVAILABLE/);
  state.sourceError=null;state.envelope={providerAsOf:new Date().toISOString(),fetchedAt:new Date().toISOString()};state.records=[{}];context.update();
  state.historyMode="2026-10-19";context.update();assert.match(elements.connection.textContent,/HISTORICAL/);
  for(const element of Object.values(elements))assert.equal(element.hidden,true);
});

test("snapshot banner is removed rather than regenerated in any KWANTY surface",()=>{
  assert.doesNotMatch(app,/actual snapshot|no full-session history loaded|no invented curve|history-limited/);
  assert.match(app,/document\.getElementById\('historyNotice'\)\?\.remove\(\)/);
  assert.doesNotMatch(app,/\$\('#historyNotice'\)/);
  assert.match(read("public/kwanty-app/index.html"),/app\.js\?v=16/);
  assert.match(read("src/components/kwanty/KwantyWorkspace.tsx"),/params\.set\("v", "8"\)/);
  assert.match(read("src/components/options-flow/OptionsFlowToolPanel.tsx"),/v: source === "kwanty" \? "10" : "4"/);
});

test("automatic provider failure retains error and backoff without a toast",async()=>{
  const state={historyMode:false,auto:true,sourceError:null,envelope:null};
  const delays=[],renders=[],failure=Object.assign(Error("UPSTREAM_ENTITLEMENT_REQUIRED"),{status:403});
  const context={state,requestId:0,modeGeneration:0,pollTimer:null,controller:null,
    document:{hidden:false},window:{__kwantyActive:true},AbortController,
    clearTimeout(){},setTimeout:(_,delay)=>delays.push(delay),identity:()=>"QQQ/orderflow",
    api:async()=>{throw failure;},query:()=>"ticker=QQQ",updateHealth:()=>renders.push("health"),renderChartEmpty:()=>renders.push("chart"),
    message:()=>{throw Error("automatic notification must not open");},
  };
  vm.runInNewContext(app.slice(app.indexOf("async function load()"),app.indexOf("function updateHealth()"))+";globalThis.run=load;",context);
  await context.run();assert.equal(state.sourceError,failure.message);
  assert.deepEqual(delays,[60000]);assert.deepEqual(renders,["health","chart"]);
  const init=app.slice(app.indexOf("async function init()"),app.indexOf("\nbindTemplates("));
  assert.doesNotMatch(init,/message\(/);
  assert.match(init,/state\.sourceError=error.message;renderChartEmpty\(\);updateHealth\(\)/);
});

test("missing-data safeguards and actual source timestamps remain",()=>{
  assert.match(app,/if\(!marker.available\)return/);
  assert.doesNotMatch(app,/message\([^\n]*(?:API authentication|Provider request failed|Gateway unavailable|invented|fabricated)/);
  assert.match(app,/message\('History is unavailable for this session\.'\)/);
  assert.match(app,/section\('update',\[\['date',new Date\(p.timestamp\*1000\)/);
  assert.match(app,/state\.historyError=error.message/);
});
