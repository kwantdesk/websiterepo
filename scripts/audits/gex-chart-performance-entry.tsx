import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from '@/components/KwantifyWorkspace';

localStorage.setItem('olisa-chart-workspace-layout','split-vertical');
localStorage.setItem('olisa-chart-workspace-panes',JSON.stringify([
 {id:'pane-1',symbol:'NQ.v.0',broker:'Databento',timeframe:'1m',period:'5D',watchlistKey:'Databento:NQ.v.0',content:'charts',locked:false},
 {id:'pane-2',symbol:'NQ.v.0',broker:'Databento',timeframe:'1m',period:'5D',watchlistKey:'Databento:NQ.v.0',content:'gexmap',locked:false},
]));
function App(){
 const [tick,setTick]=useState(0);
 Object.assign(window,{hostTick:()=>setTick(value=>value+1)});
 return <div style={{height:'100%'}} data-host-tick={tick}><Workspace section="charts" embedded/></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
