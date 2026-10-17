import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("Socials opens with its view navigation, not the removed title/tagline/account banner", () => {
  const source = readFileSync(new URL("../src/components/socials/SocialsWorkspace.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("SocialsWorkspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let header;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "header" &&
      node.openingElement.attributes.getText(ast).includes("shrink-0 bg-panel")) header = node;
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(header);
  const children = header.children.filter(node => !ts.isJsxText(node) || node.getText(ast).trim());
  assert.equal(children.length, 1);
  assert.ok(ts.isJsxSelfClosingElement(children[0]));
  assert.equal(children[0].tagName.getText(ast), "WorkspaceSubnav");
  assert.match(children[0].getText(ast), /ariaLabel="Socials views"/);
  assert.match(children[0].getText(ast), /SOCIAL_TABS\.map/);
  assert.doesNotMatch(source, /Working title|Build a record that survives review\./);
});
