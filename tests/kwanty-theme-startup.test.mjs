import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('a stalled optional theme catalogue cannot prevent application startup or activity handling',async()=>{
 const source=readFileSync(new URL('../public/kwanty-app/site-runtime.js',import.meta.url),'utf8')
  .replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
 const listeners=new Map(),events=[];let resolveTheme;
 const themeReady=new Promise(resolve=>resolveTheme=resolve);
 const host={active:true,theme:()=>({background:'#111111'}),read:()=>null};
 const window={parent:{__kwantyHost:host},addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>events.push(event.type)};
 const context=vm.createContext({window,parent:window.parent,location:{search:'',origin:'https://fixture.test'},URLSearchParams,Event,createSelectPreferences:()=>({}),installTheme:()=>themeReady});
 let completed=false;
 const boot=vm.runInContext(`(async()=>{${source}\n})()`,context).then(()=>{completed=true;});
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(completed,true,'real site-runtime module must finish while catalogue fetch is still pending');
 assert.ok(listeners.has('message'),'host activity listener must be attached before catalogue completion');
 listeners.get('message')({origin:'https://fixture.test',source:window.parent,data:{type:'kwanty-site-activity',active:false}});
 assert.equal(window.__kwantyActive,false);
 assert.ok(events.includes('kwanty-activity'));
 resolveTheme();await boot;await Promise.resolve();
 assert.ok(events.includes('kwanty-theme'),'completed optional styling must invalidate the renderer');
});
