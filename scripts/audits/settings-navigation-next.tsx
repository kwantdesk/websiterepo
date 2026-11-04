import React, { useSyncExternalStore } from 'react';
let publishedPath=location.pathname;
const notify=()=>window.dispatchEvent(new Event('fixture:path'));
const push=window.history.pushState.bind(window.history),replace=window.history.replaceState.bind(window.history);
window.history.pushState=(...args)=>{push(...args);setTimeout(()=>{publishedPath=location.pathname;notify()},2000);};
window.history.replaceState=(...args)=>{replace(...args);setTimeout(()=>{publishedPath=location.pathname;notify()},2000);};
window.addEventListener('popstate',()=>{setTimeout(()=>{publishedPath=location.pathname;notify()},2000)});
const subscribe=(fn:()=>void)=>{window.addEventListener('fixture:path',fn);window.addEventListener('popstate',fn);return()=>{window.removeEventListener('fixture:path',fn);window.removeEventListener('popstate',fn);};};
const router={push:(url:string)=>history.pushState(null,'',url),replace:(url:string)=>history.replaceState(null,'',url),prefetch:()=>{},back:()=>history.back()};
export const useRouter=()=>router;
export const usePathname=()=>useSyncExternalStore(subscribe,()=>publishedPath,()=>'/charts');
export const useSearchParams=()=>new URLSearchParams(location.search);
export const warmWorkspaceNavigation=()=>{};
export const startRendererHealthRecorder=()=>()=>{};
export default function Link({href,children,prefetch:_prefetch,...props}:{href:string;children:React.ReactNode;prefetch?:boolean;[key:string]:unknown}){return <a href={href} {...props}>{children}</a>;}
