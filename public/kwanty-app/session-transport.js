// Compact transport keeps full one-second history below the hosting response
// limit. Decoding never changes source timestamps, units or observations.
export async function decodeSessionTransport(result){
 if(result?.encoding!=='gzip-base64')return result;
 if(typeof result.data!=='string'||result.data.length>4_000_000)throw Error('INVALID_SESSION_TRANSPORT');
 const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16_000_000)throw Error('SESSION_SIZE_LIMIT');chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 const decoded=new Uint8Array(size);let offset=0;for(const chunk of chunks){decoded.set(chunk,offset);offset+=chunk.length;}
 const data=JSON.parse(new TextDecoder().decode(decoded));
 if(!Array.isArray(data)||data.length>30000)throw Error('INVALID_SESSION_TRANSPORT');
 return {...result,encoding:undefined,data};
}
