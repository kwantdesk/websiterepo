const packedPalettes = new WeakMap();

// Pixel-identical vertical heat interpolation. Row geometry is independent of
// the column, so calculate it once per output row, not once per canvas pixel.
export function writeHeatRgba(heatmap, palette, sourceX, width, rasterRows, pixels) {
  let packed = packedPalettes.get(palette);
  if (!packed) {
    packed = new Uint32Array(256);
    const bytes = new Uint8Array(packed.buffer);
    for (let i = 0; i < 256; i++) {
      bytes[i * 4] = palette[i * 3];
      bytes[i * 4 + 1] = palette[i * 3 + 1];
      bytes[i * 4 + 2] = palette[i * 3 + 2];
      bytes[i * 4 + 3] = 255;
    }
    packedPalettes.set(palette, packed);
  }
  // ImageData owns aligned RGBA bytes. Build native-endian packed colours via
  // their byte view above, so this one-store path is portable across hosts.
  const output = new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.length / 4);
  for (let row = 0; row < rasterRows; row += 1) {
    const sourceY = (row + 0.5) * heatmap.height / rasterRows - 0.5;
    const floor = Math.floor(sourceY);
    const lowOffset = Math.max(0, Math.min(heatmap.height - 1, floor)) * heatmap.width + sourceX;
    const highOffset = Math.max(0, Math.min(heatmap.height - 1, floor + 1)) * heatmap.width + sourceX;
    const linear = Math.max(0, Math.min(1, sourceY - floor));
    const mix = linear * linear * (3 - 2 * linear);
    let target = row * width;
    for (let x = 0; x < width; x += 1) {
      const low = heatmap.intensities[lowOffset + x];
      const high = heatmap.intensities[highOffset + x];
      output[target++] = packed[Math.round(low + (high - low) * mix)];
    }
  }
}
