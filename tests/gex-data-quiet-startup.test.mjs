import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bootstrap=read('public/gex-data-app/site-bootstrap.js');

test('iframe paints the current host theme before styles, modules or network requests',()=>{
  const html=read('public/gex-data-app/index.html');
  assert.ok(html.indexOf('site-bootstrap.js')<html.indexOf('rel="stylesheet"'));
  for(const background of ['#ffffff','#10051f','#001b20']){
    for(const kind of ['direct','nested','tool','popout']){
      const properties={},root={style:{setProperty:(key,value)=>properties[key]=value}};
      const host={theme:()=>({background,foreground:'#aabbcc',primary:'#ddccaa'})};
      const owner=kind==='tool'?{__kwantOptionsToolHosts:{panel:host}}:{__kwantGexDataHost:host};
      owner.parent=owner;
      const window=kind==='direct'?owner:kind==='popout'?{opener:owner}:{parent:owner};
      if(kind==='popout')window.parent=window;
      vm.runInNewContext(bootstrap,{document:{documentElement:root},location:{search:kind==='tool'?'?hostId=panel':''},window,URLSearchParams});
      assert.equal(root.style.backgroundColor,background,kind);
      assert.equal(properties['--site-background'],background);
      assert.equal(properties['--site-primary'],'#ddccaa');
    }
  }
});

test('bootstrap stops safely at cross-origin boundaries',()=>{
  const window={get __kwantGexDataHost(){throw Error('Cross origin');}};
  assert.doesNotThrow(()=>vm.runInNewContext(bootstrap,{document:{documentElement:{style:{}}},location:{search:''},window,URLSearchParams}));
});

test('theme surface changes synchronously while one shared colour download is pending',async()=>{
  let resolve;let requests=0;
  const properties={},root={style:{setProperty:(key,value)=>properties[key]=value}};
  const source=read('public/gex-data-app/site-theme.js').replaceAll('export ','').replace('import.meta.url',JSON.stringify('https://test.local/gex-data-app/site-theme.js'));
  const context={document:{documentElement:root},URL,TextEncoder,fetch:()=>{requests++;return new Promise(done=>resolve=done);}};
  vm.runInNewContext(source+';globalThis.install=installTheme;',context);
  const first=context.install({background:'#ffffff'});
  assert.equal(properties['--site-background'],'#ffffff');
  assert.equal(root.style.colorScheme,'light');
  const second=context.install({background:'#10051f',primary:'#dd00ff'});
  assert.equal(root.style.backgroundColor,'#10051f');
  assert.equal(root.style.colorScheme,'dark');
  assert.equal(requests,1);
  resolve({ok:true,json:async()=>['#a855f7']});await Promise.all([first,second]);
  assert.equal(properties['--gex-23613835356637'],'#dd00ff');
  await context.install({background:'#001b20'});assert.equal(requests,1);
});

test('page startup stays on the themed surface without a loading splash',()=>{
  const workspace=read('src/components/KwantifyWorkspace.tsx');
  const host=read('src/components/gex-data/GexDataWorkspace.tsx');
  for(const name of ['GexDataWorkspace','KwantyWorkspace']){
    const dynamicBlock=workspace.match(new RegExp(`const ${name} = dynamic\\([\\s\\S]*?\\n\\}\\);`))?.[0];
    assert.ok(dynamicBlock);
    assert.match(dynamicBlock,/loading: \(\) => <div className="h-full min-h-0 flex-1 bg-background" \/>/);
    assert.doesNotMatch(dynamicBlock,/workspaceLoader|KwantLoader/);
  }
  assert.doesNotMatch(host,/KwantLoader|Opening GEX DATA|Loading GEX DATA/);
  assert.match(host,/overflow-hidden bg-background/);
  const kwanty=read('src/components/kwanty/KwantyWorkspace.tsx');
  assert.doesNotMatch(kwanty,/KwantLoader|Loading calendar|Opening KWANTY/);
  assert.match(kwanty,/OptionsExpirationCalendar=dynamic\([^\n]+loading:\(\)=>null/);
  assert.match(kwanty,/overflow-hidden bg-background/);
});
