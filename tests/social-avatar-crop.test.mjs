import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/avatarCrop.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Math });
const draft = (width, height, zoom = 1, offsetX = 0, offsetY = 0) => ({ sourceUrl: "blob:test", naturalWidth: width, naturalHeight: height, zoom, offsetX, offsetY });

test("profile crop exports 500 square pixels and centers square, portrait and landscape sources", () => {
  assert.equal(exports.AVATAR_OUTPUT_SIZE, 500);
  for (const [width, height, x, y, size] of [[1000, 1000, 0, 0, 1000], [1600, 800, 400, 0, 800], [800, 1600, 0, 400, 800]]) {
    const rectangle = exports.avatarSourceRect(draft(width, height));
    assert.equal(rectangle.x, x); assert.equal(rectangle.y, y); assert.equal(rectangle.size, size);
  }
});

test("drag/zoom cannot expose empty edges and circular thumbnail represents the identical source crop", () => {
  for (const [width, height] of [[1920, 1080], [600, 1200], [500, 500]]) {
    for (const zoom of [1, 1.25, 2, 3]) {
      for (const [x, y] of [[0, 0], [10000, -10000], [-10000, 10000]]) {
        const state = draft(width, height, zoom, x, y);
        const offset = exports.clampAvatarOffset(state, x, y);
        const crop = { ...state, ...offset };
        const rectangle = exports.avatarSourceRect(crop);
        assert.ok(rectangle.x >= -1e-8 && rectangle.y >= -1e-8);
        assert.ok(rectangle.x + rectangle.size <= width + 1e-8);
        assert.ok(rectangle.y + rectangle.size <= height + 1e-8);
        const scale = exports.avatarCropScale(crop);
        const left = exports.AVATAR_CROP_SIZE / 2 + offset.offsetX - width * scale / 2;
        const previewLeft = left * 64 / exports.AVATAR_CROP_SIZE;
        const previewScale = scale * 64 / exports.AVATAR_CROP_SIZE;
        assert.ok(Math.abs(-previewLeft / previewScale - rectangle.x) < 1e-8);
      }
    }
  }
});

test("Socials retains explicit profile-save flow, local uploads and circular masking", () => {
  const component = readFileSync(new URL("../src/components/socials/useProfileAvatarEditor.tsx", import.meta.url), "utf8");
  assert.match(component, /canvas.width = AVATAR_OUTPUT_SIZE/);
  assert.match(component, /canvas.height = AVATAR_OUTPUT_SIZE/);
  assert.match(component, /const source = avatarSourceRect\(crop\)/);
  assert.match(component, /maxBytes: 350_000/);
  assert.match(component, /Actual circular profile preview/);
  assert.match(component, /Save your profile to publish it/);
  assert.match(component, /avatarLoadSequenceRef.current/);
  assert.doesNotMatch(component, /Profile photo prepared at 1080/);
});

function handlers() {
  const text = readFileSync(new URL("../src/components/socials/useProfileAvatarEditor.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("socials.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ["closeAvatarCrop", "selectPresetAvatar", "handleAvatar", "saveCroppedAvatar"];
  const snippets = [];
  const visit = node => { if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) snippets.push(`const ${node.getText(ast)};`); ts.forEachChild(node, visit); };
  visit(ast);
  const state = { profile: { displayName: "Trader", avatarUrl: "old" }, notice: "", images: [], revoked: [], draws: [], canvas: null };
  const context = { ...exports, avatarCrop: draft(1600, 800), avatarCropSaving: false,
    SOCIAL_AVATAR_PRESETS: ["robot", "fox"].map(id => ({ id, url: `https://kwantdesk.com/avatars/console-v1/${id}.webp` })),
    avatarLoadSequenceRef: { current: 0 }, avatarCropSourceRef: { current: "blob:test" }, avatarDragRef: { current: null },
    useCallback: fn => fn,
    setProfileDraft: update => { state.profile = update(state.profile); }, setNotice: value => { state.notice = value; },
    setAvatarCrop: value => { context.avatarCrop = typeof value === "function" ? value(context.avatarCrop) : value; },
    setAvatarCropSaving: value => { context.avatarCropSaving = value; },
    URL: { createObjectURL: () => `blob:${state.images.length}`, revokeObjectURL: value => state.revoked.push(value) },
    window: { Image: class { constructor() { this.naturalWidth = 1600; this.naturalHeight = 800; state.images.push(this); } async decode() {} } },
    document: { createElement: () => { const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage: (...args) => state.draws.push(args) }) }; state.canvas = canvas; return canvas; } },
    encodeCanvasImage: async () => ({ dataUrl: "data:image/webp;base64,cropped" }),
  };
  const js = ts.transpileModule(snippets.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = vm.runInNewContext(js + `;({${names.join(",")}})`, context);
  return { api, context, state };
}

test("upload handler rejects unsupported/oversized files and discards out-of-order loads", () => {
  const { api, state, context } = handlers();
  api.handleAvatar({ type: "image/svg+xml", size: 100 }); assert.equal(state.images.length, 0);
  api.handleAvatar({ type: "image/png", size: exports.MAX_AVATAR_SOURCE_BYTES + 1 }); assert.equal(state.images.length, 0);
  api.handleAvatar({ type: "image/png", size: 100 }); api.handleAvatar({ type: "image/jpeg", size: 100 });
  state.images[0].onload(); assert.ok(state.revoked.includes("blob:0"));
  state.images[1].onload(); assert.equal(context.avatarCrop.sourceUrl, "blob:1");
  api.selectPresetAvatar("https://kwantdesk.com/avatars/console-v1/robot.webp", "Robot");
  assert.equal(state.profile.displayName, "Trader"); assert.equal(context.avatarCrop, null);
  assert.match(state.notice, /Save your profile to publish/);
});

test("saving a crop draws the exact source region into a 500-square canvas and stages, not publishes, the image", async () => {
  const { api, state, context } = handlers();
  await api.saveCroppedAvatar();
  assert.equal(state.canvas.width, 500); assert.equal(state.canvas.height, 500);
  assert.deepEqual(Array.from(state.draws[0].slice(1)), [400, 0, 800, 800, 0, 0, 500, 500]);
  assert.equal(state.profile.avatarUrl, "data:image/webp;base64,cropped");
  assert.equal(context.avatarCropSaving, false); assert.equal(context.avatarCrop, null);
  assert.match(state.notice, /500 × 500.*Save your profile/);
});

test("a cancelled asynchronous crop cannot overwrite the newly selected preset", async () => {
  const { api, state, context } = handlers();
  let finish;
  context.encodeCanvasImage = () => new Promise(resolve => { finish = resolve; });
  const saving = api.saveCroppedAvatar();
  await new Promise(resolve => setImmediate(resolve));
  api.selectPresetAvatar("https://kwantdesk.com/avatars/console-v1/fox.webp", "Fox");
  finish({ dataUrl: "data:image/webp;base64,stale" }); await saving;
  assert.equal(state.profile.avatarUrl, "https://kwantdesk.com/avatars/console-v1/fox.webp");
});
