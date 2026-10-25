import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

for (const name of ['KwantSelect', 'TimeZoneSelect']) {
  const source = await fs.readFile(new URL(`../src/components/ui/${name}.tsx`, import.meta.url), 'utf8');
  test(`${name}: menu scroll stays open; external scroll/resize reanchors once per frame`, () => {
    const start = source.indexOf('let positionFrame: number | null = null;');
    assert.notEqual(start, -1);
    const end = source.indexOf('document.addEventListener', start);
    const body = ts.transpileModule(source.slice(start, end), {
      compilerOptions: { target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const frames = [];
    let positions = 0;
    class FakeNode {}
    const inside = new FakeNode();
    const outside = new FakeNode();
    const follow = new Function('window', 'Node', 'menuRef', 'updateMenuPosition',
      `${body}; return followViewport;`)(
      { requestAnimationFrame(callback) { frames.push(callback); return frames.length; } },
      FakeNode, { current: { contains: target => target === inside } },
      () => { positions += 1; },
    );
    follow({ type: 'scroll', target: inside });
    assert.equal(frames.length, 0, 'internal scrolling cannot reposition or dismiss options');
    follow({ type: 'scroll', target: outside });
    follow({ type: 'scroll', target: outside });
    follow({ type: 'resize', target: {} });
    assert.equal(frames.length, 1, 'momentum scroll is frame-coalesced');
    frames.shift()();
    assert.equal(positions, 1);
    follow({ type: 'scroll', target: {} }); // document/window, including scroll chaining
    frames.shift()();
    assert.equal(positions, 2);
    assert.doesNotMatch(body, /close\(|closeMenu\(|setOpen\(false/);
    assert.match(source, /overscrollBehavior: "contain"/);
    assert.match(source, /cancelAnimationFrame\(positionFrame\)/);
    assert.match(source, /removeEventListener\("scroll", followViewport, true\)/);
    assert.match(source, /event.key === "Escape"/);
    assert.match(source, /menuRef.current\?\.contains\(target\)/);
  });
}
