export type AvatarAppearance = { version: 1; presetId: string; colors: string[] };
export type PreparedAvatar = { avatarUrl: string; avatarAppearance?: AvatarAppearance };
export function normalizeAvatarColor(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return "#" + [...hex].map(c => c + c).join("").toUpperCase();
  return /^[0-9a-f]{6}$/i.test(hex) ? "#" + hex.toUpperCase() : null;
}
export function paletteEquals(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((color, index) => color.toUpperCase() === b[index]?.toUpperCase());
}
/** Map RGB stores two palette indices and their blend weight. Add only the
 * palette delta to the original pixels: stock/reset is byte-identical, and
 * original shading plus antialiased edges survive independent colour changes. */
export function recolorAvatarPixels(source: Uint8ClampedArray, map: Uint8ClampedArray, stock: readonly string[], selected: readonly string[], output = new Uint8ClampedArray(source.length)) {
  if (source.length !== map.length || source.length !== output.length || source.length % 4 || stock.length !== selected.length || !stock.length || stock.length > 12) throw new Error("Invalid avatar colour data");
  const deltas = new Float32Array(stock.length * 3);
  for (let i=0;i<stock.length;i++) {
    const original = normalizeAvatarColor(stock[i]), next = normalizeAvatarColor(selected[i]);
    if (!original || !next) throw new Error("Invalid avatar colour");
    for(let c=0;c<3;c++) deltas[i*3+c] = parseInt(next.slice(1+c*2,3+c*2),16) - parseInt(original.slice(1+c*2,3+c*2),16);
  }
  for(let p=0;p<source.length;p+=4) {
    const a=map[p]*3, b=map[p+1]*3, t=map[p+2]/255;
    if (a>=deltas.length || b>=deltas.length) throw new Error("Invalid avatar colour map");
    for(let c=0;c<3;c++) output[p+c] = source[p+c] + deltas[a+c]*(1-t) + deltas[b+c]*t;
    output[p+3]=source[p+3];
  }
  return output;
}
