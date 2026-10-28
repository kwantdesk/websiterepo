/** Normal-chart trade label geometry for other chart surfaces. */
const PAPER_LABEL_SCALE = 1.125;
export const PAPER_LABEL_HEIGHT = 16 * PAPER_LABEL_SCALE;
export const PAPER_LABEL_FONT_PX = 8 * PAPER_LABEL_SCALE;
export const PAPER_LABEL_PAD_X = 7 * PAPER_LABEL_SCALE;
export const PAPER_LABEL_HANDLE_WIDTH = 20 * PAPER_LABEL_SCALE;
export const PAPER_LABEL_CLOSE_WIDTH = 16 * PAPER_LABEL_SCALE;
export const PAPER_LABEL_ICON_PX = 10 * PAPER_LABEL_SCALE;
export function paperLabelWidthPx(text: string, handles: number, close: boolean) {
  return Math.min(240 * PAPER_LABEL_SCALE, Math.max(164 * PAPER_LABEL_SCALE, PAPER_LABEL_PAD_X * 2 + handles * PAPER_LABEL_HANDLE_WIDTH
    + (close ? PAPER_LABEL_CLOSE_WIDTH : 0) + Math.ceil(text.length * PAPER_LABEL_FONT_PX * .6)));
}
