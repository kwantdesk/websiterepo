import React from 'react';
import {createRoot} from 'react-dom/client';
import GammaWorkspace from '@/components/options-flow/GammaWorkspace';
createRoot(document.getElementById('root')!).render(<div style={{height:'100vh',display:'flex',flexDirection:'column'}}><div style={{height:46,flexShrink:0,background:'var(--panel)'}}>KwantDesk</div><div data-options-host style={{flex:1,minHeight:0}}><GammaWorkspace/></div></div>);
