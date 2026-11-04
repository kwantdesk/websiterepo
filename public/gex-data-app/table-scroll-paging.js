// Event-driven paging only: never refill a short viewport or recursively fetch
// after a response. A new downward scroll is required for each opaque cursor.
export function mountTableScrollPaging({scroller,getState,onNext}){
  let scope,pageGeneration,attempts=new Set(),pending=false,generation=0,destroyed=false,lastTop=scroller.scrollTop||0;
  const scroll=()=>{
    if(destroyed)return;const state=getState(),top=scroller.scrollTop||0,down=top>lastTop;lastTop=top;
    if(state?.scope!==scope||state?.pageGeneration!==pageGeneration){scope=state?.scope;pageGeneration=state?.pageGeneration;attempts=new Set();pending=false;generation++;}
    if(!state?.enabled||!scope||state.busy||pending||state.cursor==null||!down||scroller.clientHeight<=0||scroller.scrollHeight<=scroller.clientHeight+1||top+scroller.clientHeight<scroller.scrollHeight-140)return;
    const key=JSON.stringify(state.cursor);if(attempts.has(key))return;pending=true;const token=generation,expectedScope=scope,expectedPage=pageGeneration;
    Promise.resolve().then(()=>{const latest=getState();if(!destroyed&&token===generation&&latest?.enabled&&!latest.busy&&latest.scope===expectedScope&&latest.pageGeneration===expectedPage&&JSON.stringify(latest.cursor)===key){attempts.add(key);return onNext();}}).catch(()=>{/* The caller exposes its request failure and accessible retry. */}).finally(()=>{if(token===generation)pending=false;});
  };
  scroller.addEventListener('scroll',scroll,{passive:true});return ()=>{destroyed=true;generation++;scroller.removeEventListener('scroll',scroll);};
}
