import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {unstable_doesMiddlewareMatch} from 'next/experimental/testing/server.js';

const source=ts.createSourceFile('middleware.ts',readFileSync(new URL('../middleware.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const declaration=source.statements.filter(ts.isVariableStatement).flatMap(statement=>statement.declarationList.declarations).find(declaration=>declaration.name.getText(source)==='config');
const matcher=declaration.initializer.properties.find(property=>property.name.getText(source)==='matcher').initializer.elements.map(element=>element.text);
const matches=url=>unstable_doesMiddlewareMatch({config:{matcher},nextConfig:{},url});

test('phone presentation assets load directly, including cache-version URLs',()=>{
  for(const url of ['/phone-workspace.css','/phone-workspace.js','/phone-workspace.css?v=20261104','/phone-workspace.js?v=20261104']) assert.equal(matches(url),false,url);
});
test('phone asset exemption cannot bypass account or data authentication',()=>{
  for(const url of ['/charts','/journal','/api/kwanty/snapshot','/api/gex-data/status','/api/phone-workspace.js','/phone-workspace.js/other','/phone-workspace.css/private']) assert.equal(matches(url),true,url);
});
