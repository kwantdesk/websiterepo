import React from 'react';
import {createRoot} from 'react-dom/client';
import GexMapWorkspace from '@/components/gex-map/GexMapWorkspace';
createRoot(document.getElementById('root')!).render(<div style={{height:'100dvh',width:'100%'}}><GexMapWorkspace /></div>);
