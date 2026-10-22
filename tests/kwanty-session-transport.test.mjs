import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {decodeSessionTransport} from '../public/kwanty-app/session-transport.js';
test('compressed session retains exact timestamps, nulls and native metric units',async()=>{
 const rows=[{ticker:'QQQ',timestamp:1792612800,cvroflow:-10.9,zcvr:null,spot:725.42}];
 const packed={source:'provider-eod-archive',encoding:'gzip-base64',data:gzipSync(JSON.stringify(rows)).toString('base64')};
 const result=await decodeSessionTransport(packed);assert.deepEqual(result.data,rows);assert.equal(result.source,packed.source);
});
test('unencoded responses are unchanged and malformed/oversized encodings reject',async()=>{
 const response={data:[]};assert.equal(await decodeSessionTransport(response),response);
 for(const data of ['not gzip',null,'x'.repeat(4_000_001)])await assert.rejects(()=>decodeSessionTransport({encoding:'gzip-base64',data}));
 await assert.rejects(()=>decodeSessionTransport({encoding:'gzip-base64',data:gzipSync('0'.repeat(16_000_001)).toString('base64')}),/SESSION_SIZE_LIMIT/);
});
