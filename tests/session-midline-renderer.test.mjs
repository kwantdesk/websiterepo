import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('src/components/Chart.tsx', 'utf8');
const start = source.indexOf('class SessionWindowRenderer '), end = source.indexOf('\nclass SessionWindowView ', start);
const renderer = ts.transpile(source.slice(start, end) + '\n globalThis.Renderer = SessionWindowRenderer;', { target: ts.ScriptTarget.ES2022 });
test('Sessions midpoint toggle controls the real renderer at the arithmetic price midpoint', () => { const scope = {}; vm.runInNewContext(renderer, scope); const segments = []; let path = []; const context = { save() { }, restore() { }, beginPath() { path = []; }, rect() { }, clip() { }, setLineDash() { }, moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); }, stroke() { segments.push(path); } }; const session = { startTime: 10, endTime: 20, high: 120, low: 100, color: '#FF0000', lineOpacity: .8, showMidline: false }; const primitive = { chart: () => ({ timeScale: () => ({ timeToCoordinate: t => t, options: () => ({ barSpacing: 5 }) }) }), series: () => ({ priceToCoordinate: p => 500 - p * 2 }), sessions: () => [session] }; const r = new scope.Renderer(primitive), target = { useMediaCoordinateSpace: fn => fn({ context, mediaSize: { width: 800, height: 600 } }) }; r.draw(target); assert.equal(segments.length, 0); session.showMidline = true; r.draw(target); assert.deepEqual(Array.from(segments[0], point => Array.from(point)), [[10, 280], [25, 280]]); session.showMidline = false; r.draw(target); assert.equal(segments.length, 1); });
