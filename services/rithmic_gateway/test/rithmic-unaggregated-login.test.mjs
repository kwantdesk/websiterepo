import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {fileURLToPath} from 'node:url';import {WebSocketServer} from 'ws';import {RithmicMarketDataClient} from '../src/rithmic-client.mjs';
test('ticker login explicitly requests unaggregated quotes on the actual protobuf wire',async()=>{
 const server=new WebSocketServer({host:'127.0.0.1',port:0});await once(server,'listening');let login;
 const client=new RithmicMarketDataClient({url:'ws://127.0.0.1:'+server.address().port,protoDir:fileURLToPath(new URL('../vendor/proto',import.meta.url)),subscriptions:[],user:'fixture',password:'fixture',systemName:'fixture',appName:'fixture',appVersion:'1'});
 client.stopped=false; server.on('connection',socket=>socket.on('message',bytes=>{if(client.protocol.templateId(bytes)!==10)return;const type=client.protocol.root.lookupType('rti.RequestLogin');login=type.toObject(type.decode(bytes),{defaults:false});socket.send(client.protocol.encode('ResponseLogin',{templateId:11,rpCode:['0'],heartbeatInterval:30}));}));
 try{await client.connectOnce();assert.equal(client.status.authenticated,true);assert.equal(Object.hasOwn(login,'aggregatedQuotes'),true);assert.equal(login.aggregatedQuotes,false);}finally{await client.stop();for(const socket of server.clients)socket.terminate();await new Promise(resolve=>server.close(resolve));}
});
