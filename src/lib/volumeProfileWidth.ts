/** Fine control below width 4; applied after layout floors so 1 really is
 * one-quarter of its former size. Normal/default widths stay unchanged. */
export function fineVolumeProfileWidth(pixelWidth: number, setting: number): number {
  if (!Number.isFinite(pixelWidth) || !Number.isFinite(setting) || pixelWidth <= 0 || setting <= 0) return 0;
  return pixelWidth * Math.min(setting / 4, 1);
}
