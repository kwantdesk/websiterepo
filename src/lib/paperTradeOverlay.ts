/** Normal-chart trade label geometry for other chart surfaces. */
export const PAPER_LABEL_HEIGHT = 24;
export const PAPER_LABEL_FONT_PX = 12;
export const PAPER_LABEL_PAD_X = 10.5;
export const PAPER_LABEL_HANDLE_WIDTH = 30;
export const PAPER_LABEL_CLOSE_WIDTH = 24;
export const PAPER_LABEL_ICON_PX = 15;
export function paperLabelWidthPx(text: string, handles: number, close: boolean) {
  return Math.min(360, Math.max(246, PAPER_LABEL_PAD_X * 2 + handles * PAPER_LABEL_HANDLE_WIDTH
    + (close ? PAPER_LABEL_CLOSE_WIDTH : 0) + Math.ceil(text.length * PAPER_LABEL_FONT_PX * .6)));
}
