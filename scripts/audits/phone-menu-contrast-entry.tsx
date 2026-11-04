import React from 'react';
import {createRoot} from 'react-dom/client';
import {ChartNoAxesCombined,Home,Settings,Newspaper} from 'lucide-react';
import MobileWorkspaceNavigation from '@/components/MobileWorkspaceNavigation';
import {themePresets} from '@/lib/themePresets';
(window as any).menuThemes=themePresets;
(window as any).setMenuTheme=(colors:Record<string,string>)=>{for(const [k,v] of Object.entries(colors))document.documentElement.style.setProperty('--'+k.replace(/([A-Z])/g,'-$1').toLowerCase(),v);window.dispatchEvent(new CustomEvent('kwantdesk:theme-change'));};
createRoot(document.getElementById('root')!).render(<MobileWorkspaceNavigation activeItem="charts" items={[{key:'home',href:'/',label:'Home',icon:Home},{key:'charts',href:'/charts',label:'Charts',icon:ChartNoAxesCombined},{key:'news',href:'/news',label:'News',icon:Newspaper},{key:'settings',href:'/settings',label:'Settings',icon:Settings}]} actions={[{label:'Workspace',onClick:()=>{}},{label:'Chart 1: NQ',active:true,onClick:()=>{}},{label:'Watchlist',onClick:()=>{}}]} onNavigate={event=>event.preventDefault()} onPointerNavigate={()=>{}}/>);
