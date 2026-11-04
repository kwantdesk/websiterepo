import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {unstable_doesMiddlewareMatch} from 'next/experimental/testing/server.js';
const source=ts.createSourceFile('middleware.ts',readFileSync(new URL('../middleware.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const declaration=source.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>d.name.getText(source)==='config');
const matcher=declaration.initializer.properties.find(p=>p.name.getText(source)==='matcher').initializer.elements.map(e=>e.text);
const matches=url=>unstable_doesMiddlewareMatch({config:{matcher},nextConfig:{},url});
test('shared loading JS and CSS are static presentation assets, including versioned iframe imports',()=>{
 for(const url of ['/workspace-loading.js','/workspace-loading.js?v=1','/workspace-loading.css','/workspace-loading.css?v=1'])assert.equal(matches(url),false,url);
});
test('the loading-asset exemption cannot bypass workspace, account or market-data authentication',()=>{
 for(const url of ['/kwanty','/charts','/accounts','/api/kwanty/snapshot','/api/market-data/index-stream','/api/workspace-loading.js','/workspace-loading.js/private','/workspace-loading.css/other','/workspace-loading.json'])assert.equal(matches(url),true,url);
});
