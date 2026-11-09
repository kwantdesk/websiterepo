import React from 'react';
import {createRoot} from 'react-dom/client';
import GexDataWorkspace from '@/components/gex-data/GexDataWorkspace';
createRoot(document.getElementById('root')!).render(<div style={{height:'100vh',display:'flex'}}><GexDataWorkspace accountKey="settings-fixture-account"/></div>);
