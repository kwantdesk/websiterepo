// Source controls: Dark Flow 670594, Net Drift 546574 / 957122,
// Max Pain 950920. These are presentation settings, never provider filters.
const DEFINITIONS=Object.freeze({
  'dark-flow':[
    {id:'notional',label:'Notional Value',required:true},
    {id:'underlying',label:'Underlying',control:'darkUnderlying',defaultValue:'SHOW'}
  ],
  'net-drift':[
    {id:'call',label:'Calls',control:'driftCalls',defaultValue:'SHOW'},
    {id:'put',label:'Puts',control:'driftPuts',defaultValue:'SHOW'},
    {id:'net',label:'Net Premium',control:'driftNet',defaultValue:'HIDE'},
    {id:'underlying',label:'Underlying',control:'driftUnderlying',defaultValue:'SHOW'}
  ],
  'max-pain':[
    {id:'call',label:'Calls',control:'painCalls',defaultValue:'SHOW'},
    {id:'put',label:'Puts',control:'painPuts',defaultValue:'SHOW'}
  ]
});

export function toolSeriesOptions(toolId){return (DEFINITIONS[toolId]||[]).map(option=>({...option}));}

export function toolSeriesVisibility(toolId,controls={}){
  return Object.fromEntries(toolSeriesOptions(toolId).map(option=>{
    const value=controls[option.control]??option.defaultValue;
    return [option.id,option.required===true||value===true||value==='SHOW'];
  }));
}

export function setToolSeriesVisibility(toolId,controls={},seriesId,visible){
  const result={...controls},options=toolSeriesOptions(toolId),option=options.find(item=>item.id===seriesId);
  if(!option||option.required||typeof visible!=='boolean')return result;
  const state=toolSeriesVisibility(toolId,controls);
  // Match the reference's canHideMoreSeries protection: do not leave the
  // chart with no displayed series. Max Pain's price marker is not a bar leg.
  if(!visible&&state[seriesId]&&Object.values(state).filter(Boolean).length<=1)return result;
  result[option.control]=visible?'SHOW':'HIDE';return result;
}
