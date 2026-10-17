import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const receipt = JSON.parse(readFileSync(path.join(root, "docs/avatar-art/console-avatars-prompts.json"), "utf8"));
if (receipt.assets.length !== 30) throw new Error("Expected exactly thirty avatars");
const directory = path.join(root, "public/images/avatars/console-v1");
mkdirSync(directory, { recursive: true });
// Only resize/encode originals for delivery; no runtime image generation.
for (const asset of receipt.assets) {
  if (!/^[a-z0-9-]+$/.test(asset.id)) throw new Error("Invalid avatar ID");
  const output = path.join(directory, `${asset.id}.webp`);
  if (!existsSync(output)) await sharp(asset.source).resize(500, 500).webp({ quality: 85 }).toFile(output);
  const metadata = await sharp(output).metadata();
  if (metadata.width !== 500 || metadata.height !== 500 || metadata.format !== "webp") throw new Error(`Bad avatar output: ${asset.id}`);
}
// Review sheet only: display every avatar in its actual circular presentation.
const tiles = [];
for (let index = 0; index < receipt.assets.length; index++) {
  const asset = receipt.assets[index];
  const pixels = await sharp(path.join(directory, `${asset.id}.webp`)).resize(120, 120).composite([{ input: Buffer.from('<svg width="120" height="120"><circle cx="60" cy="60" r="59" fill="white"/></svg>'), blend: "dest-in" }]).png().toBuffer();
  const left = (index % 6) * 150 + 15, top = Math.floor(index / 6) * 150 + 8;
  tiles.push({ input: pixels, left, top });
  tiles.push({ input: Buffer.from(`<svg width="150" height="20"><text x="75" y="14" font-family="Arial" font-size="11" fill="#e5e7eb" text-anchor="middle">${asset.name}</text></svg>`), left: (index % 6) * 150, top: top + 124 });
}
const preview = path.join(root, "docs/avatar-art/console-avatars-review.webp");
await sharp({ create: { width: 900, height: 750, channels: 4, background: "#10141d" } }).composite(tiles).webp({ quality: 90 }).toFile(preview);
console.log(JSON.stringify({ assets: receipt.assets.length, directory, preview }));
