// Presentation-only selections must survive DOM saves and copied c_ URLs.
// This module neither fetches data nor changes the provider request contract.
const MAX_ITEMS=4096,MAX_TEXT=65536;
const SPECS={
  'volatility-skew':{arrays:{visibleExpiry:'date',visibleContractType:'contract'},legacy:['expiry','contractTypeOptional','contractType'],dom:['mode','date','ticker']},
  'term-structure':{arrays:{termExpirations:'date',termStrikes:'strike'},legacy:['expiry','expiryStart','expiryEnd','minStrike','maxStrike'],dom:['mode','date','ticker','moneyType','deltaMin','deltaMax']}
};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(object,key)=>record(object)&&Object.hasOwn(object,key)&&object[key]!==undefined;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const strike=value=>{
  if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()!==''))throw Error('Choose finite surface strikes in dollars.');
  const number=Number(value);if(!Number.isFinite(number)||number<0)throw Error('Choose finite nonnegative surface strikes in dollars.');return number;
};

function list(value,kind){
  let values=value;
  if(typeof values==='string'){
    if(values.length>MAX_TEXT)throw Error('Surface selection is too large.');
    const text=values.trim();
    if(text.startsWith('[')){try{values=JSON.parse(text);}catch{throw Error('Choose a valid surface selection list.');}}
    else values=text===''?[]:text.split(',').map(value=>value.trim());
  }
  if(!Array.isArray(values)||values.length>MAX_ITEMS)throw Error('Choose a bounded surface selection list.');
  return [...new Set(values.map(value=>{
    if(kind==='strike')return strike(value);
    if(kind==='date'){if(!date(value))throw Error('Choose valid surface expiration dates.');return value;}
    if(typeof value!=='string'||!['BOTH','CALL','PUT'].includes(value.toUpperCase()))throw Error('Choose Combined, Calls or Puts.');return value.toUpperCase();
  }))];
}

function parameterValues(parameters,keys){
  if(parameters==null)return {};
  const params=typeof parameters==='string'?new URLSearchParams(parameters):parameters,result={};
  for(const key of keys){
    const name='c_'+key;
    if(typeof params?.has==='function'&&typeof params?.get==='function'){if(params.has(name))result[key]=params.get(name);}
    else if(own(params,name))result[key]=params[name];
  }
  return result;
}

export function restoreSurfaceSelections(toolId,{saved={},parameters=null}={}){
  const spec=Object.hasOwn(SPECS,toolId)?SPECS[toolId]:null;if(!spec)return {};
  const keys=[...Object.keys(spec.arrays),...spec.legacy],input={};
  for(const key of keys)if(own(saved,key))input[key]=saved[key];
  Object.assign(input,parameterValues(parameters,keys));
  const result={};
  for(const [key,kind]of Object.entries(spec.arrays))if(own(input,key))result[key]=list(input[key],kind);
  if(toolId==='volatility-skew'){
    if(!own(result,'visibleExpiry')&&own(input,'expiry')){const dates=list(input.expiry,'date');if(dates.length)result.visibleExpiry=dates;}
    if(!own(result,'visibleContractType')){
      const legacy=own(input,'contractTypeOptional')&&input.contractTypeOptional!==''?input.contractTypeOptional:input.contractType;
      if(legacy!==undefined&&legacy!==''){const types=list(legacy,'contract');if(types.length)result.visibleContractType=types;}
    }
    return result;
  }
  // New arrays override their legacy range, including explicit [] = All.
  if(!own(result,'termExpirations')){
    if(own(input,'expiry'))result.expiry=list(input.expiry,'date');
    for(const key of ['expiryStart','expiryEnd'])if(own(input,key)){if(input[key]!==''&&!date(input[key]))throw Error('Choose a valid legacy expiration range.');result[key]=input[key];}
    if(result.expiryStart&&result.expiryEnd&&result.expiryStart>result.expiryEnd)throw Error('Choose an ordered legacy expiration range.');
  }
  if(!own(result,'termStrikes')){
    for(const key of ['minStrike','maxStrike'])if(own(input,key))result[key]=input[key]===''?'':strike(input[key]);
    if(typeof result.minStrike==='number'&&typeof result.maxStrike==='number'&&result.minStrike>result.maxStrike)throw Error('Choose an ordered legacy strike range.');
  }
  return result;
}

export function persistSurfaceSelections(toolId,previous={},domValues={}){
  const spec=Object.hasOwn(SPECS,toolId)?SPECS[toolId]:null;if(!spec)return {};
  const surface={};
  for(const key of [...Object.keys(spec.arrays),...spec.legacy]){
    if(own(previous,key))surface[key]=previous[key];
    if(own(domValues,key))surface[key]=domValues[key];
  }
  const result=restoreSurfaceSelections(toolId,{saved:surface});
  for(const key of spec.dom)if(own(domValues,key)||own(previous,key)){
    const value=own(domValues,key)?domValues[key]:previous[key];
    if((typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')||typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&value.length>MAX_TEXT)throw Error('Choose valid surface controls.');
    result[key]=value;
  }
  return result;
}
