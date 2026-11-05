import {themePaint} from './site-theme.js';

// Fresh source6463 selects each latest/next major independently of metric
// expiry. Its legacy membership defaults differ from its newer color defaults:
// latest enabled, next disabled. Keep that effective state in one setting.
export const ORDERFLOW_MAJOR_LEVELS=Object.freeze([
 {key:'zero_mcall',field:'zero_mcall',family:'gex',label:'Major Call Gamma',legacy:'major_call_gamma',color:'#00ff00',display:true},
 {key:'zero_mput',field:'zero_mput',family:'gex',label:'Major Put Gamma',legacy:'major_put_gamma',color:'#ff0000',display:true},
 {key:'one_mcall',field:'one_mcall',family:'gex',label:'Major Call Gamma (Next)',legacy:'major_call_gamma',color:'#006400',display:false},
 {key:'one_mput',field:'one_mput',family:'gex',label:'Major Put Gamma (Next)',legacy:'major_put_gamma',color:'#8B0000',display:false},
 {key:'zero_mlgamma',field:'z_mlgamma',family:'convexity',label:'Major Long Gamma',legacy:'major_long_gamma',color:'#00FFFF',display:true},
 {key:'zero_msgamma',field:'z_msgamma',family:'convexity',label:'Major Short Gamma',legacy:'major_short_gamma',color:'#ae4ad5',display:true},
 {key:'one_mlgamma',field:'o_mlgamma',family:'convexity',label:'Major Long Gamma (Next)',legacy:'major_long_gamma',color:'#008B8B',display:false},
 {key:'one_msgamma',field:'o_msgamma',family:'convexity',label:'Major Short Gamma (Next)',legacy:'major_short_gamma',color:'#800080',display:false}
].map(value=>Object.freeze(value)));

export function orderflowMajorSetting(settings,key){
 const definition=ORDERFLOW_MAJOR_LEVELS.find(value=>value.key===key);if(!definition)return undefined;
 const legacy=settings?.[definition.legacy]||{},exact=settings?.[key];
 // Existing custom style/hidden preference survives migration. A legacy
 // shared display:true cannot invent an independently enabled next overlay.
 const inherited={...legacy,color:legacy.isCustomized&&legacy.color?legacy.color:themePaint(definition.color),display:legacy.display===false?false:definition.display};
 return {...inherited,...exact};
}

export function orderflowMajorLevels(metric,settings={}){
 const family=['net-gex','gex-orderflow'].includes(metric)?'gex':['net-convexity','convexity-orderflow'].includes(metric)?'convexity':null;
 if(!family)return [];
 return ORDERFLOW_MAJOR_LEVELS.filter(definition=>definition.family===family).flatMap(definition=>{
  const style=orderflowMajorSetting(settings,definition.key);if(style.display===false)return [];
  return [{field:definition.field,label:definition.label,color:style.color,defaultColor:themePaint(definition.color),isCustomized:style.isCustomized,dash:style.dash||[9,9],size:style.size||1}];
 });
}
