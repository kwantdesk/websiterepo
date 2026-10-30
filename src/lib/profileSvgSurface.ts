/** SVG output surface for the existing native profile painter. No global
 * Path2D replacement, market-data reconstruction or second histogram renderer. */
export class ProfileSvgPath {
  d = "";
  moveTo(x: number, y: number) { this.d += `M${x} ${y}`; }
  lineTo(x: number, y: number) { this.d += `L${x} ${y}`; }
  rect(x: number, y: number, w: number, h: number) { this.d += `M${x} ${y}h${w}v${h}h${-w}Z`; }
  roundRect(x: number, y: number, w: number, h: number, radii: number | number[] = 0) {
    const raw = typeof radii === "number" ? [radii, radii, radii, radii] : radii;
    const [a, b, c, d] = raw.map(r => Math.max(0, Math.min(r, w / 2, h / 2)));
    this.d += `M${x+a} ${y}H${x+w-b}A${b} ${b} 0 0 1 ${x+w} ${y+b}V${y+h-c}A${c} ${c} 0 0 1 ${x+w-c} ${y+h}H${x+d}A${d} ${d} 0 0 1 ${x} ${y+h-d}V${y+a}A${a} ${a} 0 0 1 ${x+a} ${y}Z`;
  }
}
export type ProfileSvgGradient = { id: string; x0: number; y0: number; x1: number; y1: number; stops: Array<{ offset: number; color: string }> };
type PaintColor = string | ProfileSvgGradient;
type PaintState = { fillStyle: PaintColor; strokeStyle: PaintColor; globalAlpha: number; lineWidth: number; lineJoin: string; font: string; textAlign: string; textBaseline: string; dash: number[]; clip: string | null };
export type ProfileSvgPaint = PaintState & ({ kind: "fill" | "stroke"; d: string } | { kind: "text"; text: string; x: number; y: number });

export function createProfileSvgSurface(prefix: string, measure: (text: string, font: string) => number) {
  const paints: ProfileSvgPaint[] = [], gradients: ProfileSvgGradient[] = [], clips: Array<{ id: string; d: string }> = [];
  let state: PaintState = { fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1, lineWidth: 1, lineJoin: "miter", font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic", dash: [], clip: null };
  const stack: PaintState[] = [];
  let path = new ProfileSvgPath();
  const paint = (kind: "fill" | "stroke", supplied = path) => { if (supplied.d) paints.push({ ...state, dash: [...state.dash], kind, d: supplied.d }); };
  const rect = (kind: "fill" | "stroke", x: number, y: number, w: number, h: number) => { const p = new ProfileSvgPath(); p.rect(x, y, w, h); paint(kind, p); };
  const methods = {
    save: () => stack.push({ ...state, dash: [...state.dash] }),
    restore: () => { state = stack.pop() ?? state; },
    beginPath: () => { path = new ProfileSvgPath(); },
    moveTo: (x: number, y: number) => path.moveTo(x, y), lineTo: (x: number, y: number) => path.lineTo(x, y),
    rect: (x: number, y: number, w: number, h: number) => path.rect(x, y, w, h),
    fill: (p?: ProfileSvgPath) => paint("fill", p), stroke: (p?: ProfileSvgPath) => paint("stroke", p),
    fillRect: (x: number, y: number, w: number, h: number) => rect("fill", x, y, w, h),
    strokeRect: (x: number, y: number, w: number, h: number) => rect("stroke", x, y, w, h),
    clip: () => { const id = `${prefix}-clip-${clips.length}`; clips.push({ id, d: path.d }); state.clip = id; },
    setLineDash: (dash: number[]) => { state.dash = [...dash]; },
    measureText: (text: string) => ({ width: measure(text, state.font) }),
    fillText: (text: string, x: number, y: number) => paints.push({ ...state, dash: [...state.dash], kind: "text", text, x, y }),
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      const gradient: ProfileSvgGradient = { id: `${prefix}-gradient-${gradients.length}`, x0, y0, x1, y1, stops: [] };
      gradients.push(gradient);
      return { ...gradient, addColorStop: (offset: number, color: string) => gradient.stops.push({ offset, color }) };
    },
  };
  // Canvas owns rasterization in normal profiles; the draw layer owns SVG.
  // This narrow adapter exposes exactly the painter's media-coordinate API.
  const context = new Proxy({}, {
    get: (_target, key: string) => key in methods ? methods[key as keyof typeof methods] : state[key as keyof PaintState],
    set: (_target, key: string, value) => { Object.assign(state, { [key]: value }); return true; },
  }) as CanvasRenderingContext2D;
  return { context, paints, gradients, clips };
}
