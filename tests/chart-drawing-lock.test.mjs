import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { DrawingManager } from '../src/vendor/lightweight-charts-drawing/core/drawing-manager.ts';
import { drawingSpecs, svgDrawingFixture } from './helpers/drawing-hit-harness.mjs';

test('every SVG tool keeps its drawing visible but exposes no grab handles or placement surface while locked', () => {
  for (const spec of drawingSpecs) {
    const { drawing } = svgDrawingFixture(spec.id);
    for (const activeTool of ['cursor', 'eraser', spec.id]) {
      const { html } = svgDrawingFixture(spec.id, { readOnly: true, activeTool, drawings: [drawing], selectedId: drawing.id });
      assert.ok(html.includes(drawing.id), `${spec.id}: retained drawing`);
      assert.doesNotMatch(html, /data-draw-hit="(?:handle|drawing)"|pointer-events:(?:all|auto)/, `${spec.id}: gestures pass through`);
    }
  }
});

test('native drawings stop capturing gestures and pending geometry updates, without changing individual locks', () => {
  const manager = new DrawingManager();
  const drawing = { id: 'line', anchors: [{ time: 1, price: 1 }, { time: 2, price: 2 }], options: { locked: false }, setState() {} };
  manager._drawings.set(drawing.id, drawing);
  manager.getPointFromEvent = () => ({ x: 1, y: 1 });
  manager.hitTest = () => drawing;
  manager.getViewport = () => ({ timeScale: { coordinateToTime: () => 1 }, priceScale: { coordinateToPrice: () => 1 } });
  manager.selectDrawing(drawing.id);
  manager._isDragging = true;
  manager._pendingDragPoint = { x: 2, y: 2 };
  manager.setInteractionEnabled(false);
  assert.equal(manager._isDragging, false);
  assert.equal(manager._pendingDragPoint, null);
  assert.equal(drawing.options.locked, false);
  const event = { button: 0, ctrlKey: true, preventDefault() { throw Error('chart gesture was captured'); }, stopPropagation() { throw Error('chart gesture was captured'); } };
  manager.handleMouseDown(event);
  manager.handleMouseMove(event);
  manager.handleDoubleClick(event);
  assert.equal(manager._isMarqueeSelecting, false);
  manager.setInteractionEnabled(true);
  assert.equal(drawing.options.locked, false);
  manager.handleClick({ point: { x: 1, y: 1 } });
  assert.equal(manager.getSelectedDrawing()?.id, drawing.id);
});

test('each pane toggles its own saved drawing lock and normalization preserves it', () => {
  const source = fs.readFileSync('src/components/KwantifyWorkspace.tsx', 'utf8');
  const ast = ts.createSourceFile('workspace.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && ['renderChartDrawingLockButton', 'normalizeWorkspacePane'].includes(node.name?.text)) functions.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const panes = [{ id: 'a', broker: 'Databento', symbol: 'NQ', locked: false }, { id: 'b', broker: 'Databento', symbol: 'ES', locked: true }];
  const context = { React, Lock: () => null, Unlock: () => null, updateWorkspacePane: (id, patch) => Object.assign(panes.find(p => p.id === id), patch), isMarketIndexSymbol: () => false, supportsChartInterval: () => true, makeWatchlistKey: s => s, isWorkspacePanelKind: () => true, normalizeOptionsFlowState: v => v };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const button = context.renderChartDrawingLockButton(panes[0]);
  assert.equal(button.props['aria-pressed'], false);
  button.props.onClick();
  assert.equal(panes[0].drawingsLocked, true);
  assert.equal(panes[1].drawingsLocked, undefined);
  assert.equal(panes[0].locked, false, 'layout pin is independent');
  assert.equal(context.normalizeWorkspacePane(JSON.parse(JSON.stringify(panes[0])), panes[0]).drawingsLocked, true);
  const lockedButton = context.renderChartDrawingLockButton(panes[0]);
  assert.equal(lockedButton.props['aria-pressed'], true);
  lockedButton.props.onClick();
  assert.equal(panes[0].drawingsLocked, false);
});
