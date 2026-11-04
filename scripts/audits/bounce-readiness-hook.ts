import {prepareBounceGexMirror,selectBounceGexMirror} from '@/lib/bounceGexMapMirror';
import {projectionFixture} from '../../tests/fixtures/bounceProjection';
import {normalizeLinkedGexMapSettings,DEFAULT_LINKED_GEX_MAP_SETTINGS} from '@/lib/gexMapLinkedSettings';
const profile=normalizeLinkedGexMapSettings({...DEFAULT_LINKED_GEX_MAP_SETTINGS,viewMode:'full'}),cache=new Map();
export function useBounceGexMapMirror(input:any){if(!cache.has(input.instrument)){const f=projectionFixture(input.instrument==='SPXW'?'SPX':input.instrument);cache.set(input.instrument,{snapshot:selectBounceGexMirror(prepareBounceGexMirror({payload:f.payload,settings:profile,displayInstrument:input.instrument,displayPriceAt:f.displayPriceAt,liveDisplayPrice:f.payload.stockPrice,colorScale:['#00ffff','#111111','#ff00cc']}),null),profile,loading:false,error:null,key:input.instrument});}return cache.get(input.instrument);}
