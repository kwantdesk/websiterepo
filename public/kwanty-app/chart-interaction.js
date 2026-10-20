// Pure viewport transforms. Domain values are renderer milliseconds/raw units;
// gestures never fetch data or infer prices from exposure/positioning snapshots.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validRange = (min, max) => finite(min) && finite(max) && max > min && finite(max - min);
const validPlot = g => g && validRange(g.left, g.right) && validRange(g.top, g.bottom);
const copy = view => ({...(view || {})});

export function chartRegion(pkg, geometry, point) {
  if (!validPlot(geometry) || !finite(point?.x) || !finite(point?.y)) return null;
  const {left, right, top, bottom} = geometry, {x, y} = point;
  if (x >= left && x <= right) {
    if (y < top) return pkg === 'orderflow' ? null : 'exposure-axis';
    if (y > bottom) return 'time-axis';
    return 'plot';
  }
  if (y < top || y > bottom) return null;
  if (pkg === 'orderflow') return x < left ? 'metric-axis' : geometry.priceAxisVisible === false ? null : 'price-axis';
  return (geometry.priceAxisSide ?? (geometry.alignment === 'right' ? 'right' : 'left')) === 'right' ? x > right ? 'price-axis' : null : x < left ? 'price-axis' : null;
}

function rangeFor(geometry, axis) {
  if (axis === 'time') return ['startTime', 'endTime', geometry.startTime, geometry.endTime, 1000];
  if (axis === 'exposure') return ['minExposure', 'maxExposure', geometry.minExposure, geometry.maxExposure, .0001];
  if (axis === 'metric') return ['minValue', 'maxValue', geometry.minValue, geometry.maxValue, .0001];
  if (axis === 'spot') return ['minSpot', 'maxSpot', geometry.spotDomain?.[0], geometry.spotDomain?.[1], .001];
  return ['minPrice', 'maxPrice', geometry.minPrice, geometry.maxPrice, .001];
}

function transformedRange(geometry, axis, ratio, factor, translate = 0) {
  const [minKey, maxKey, min, max, minimum] = rangeFor(geometry, axis);
  if (!validRange(min, max) || !finite(ratio) || !finite(factor) || factor <= 0 || !finite(translate)) return {};
  const span = max - min;
  // Bound extreme input without changing the current source domain. Precision
  // floor also prevents max===min when zooming at large epoch/price values.
  const floor = Math.max(minimum, Math.max(Math.abs(min), Math.abs(max)) * Number.EPSILON * 16);
  const nextSpan = Math.max(floor, span * factor);
  const anchor = min + clamp(ratio, 0, 1) * span;
  const nextMin = anchor - clamp(ratio, 0, 1) * nextSpan + translate;
  const nextMax = nextMin + nextSpan;
  return validRange(nextMin, nextMax) ? {[minKey]: nextMin, [maxKey]: nextMax} : {};
}

function axisFor(pkg, region, ctrlKey) {
  if (region === 'price-axis') return pkg === 'orderflow' ? 'spot' : 'price';
  if (region === 'metric-axis') return 'metric';
  if (region === 'exposure-axis' || (region === 'plot' && pkg !== 'orderflow' && ctrlKey)) return 'exposure';
  if (region === 'plot' || region === 'time-axis') return 'time';
  return null;
}

export function zoomChartView(pkg, geometry, view, gesture = {}) {
  const result = copy(view);
  if (!validPlot(geometry) || !finite(gesture.x) || !finite(gesture.y) || !finite(gesture.deltaY) || gesture.deltaY===0) return result;
  // Several wheel events can arrive before the next animation-frame paint.
  // Accumulate against the latest requested view, not stale rendered geometry.
  geometry={...geometry};
  for(const [min,max] of [['startTime','endTime'],['minPrice','maxPrice'],['minExposure','maxExposure'],['minValue','maxValue']])if(validRange(view?.[min],view?.[max])){geometry[min]=view[min];geometry[max]=view[max];}
  if(validRange(view?.minSpot,view?.maxSpot))geometry.spotDomain=[view.minSpot,view.maxSpot];
  const region = gesture.region ?? chartRegion(pkg, geometry, gesture);
  // Match the reference's advertised Ctrl+wheel vertical scaling. Horizontal
  // exposure scaling remains on the exposure axis (and Ctrl+drag).
  const axis = gesture.ctrlKey && region ? pkg === 'orderflow' ? region==='price-axis'?'spot':'metric' : 'price' : axisFor(pkg, region, false);
  if (!axis) return result;
  const horizontal = axis === 'time' || axis === 'exposure';
  const ratio = horizontal ? (gesture.x - geometry.left) / (geometry.right - geometry.left) : (geometry.bottom - gesture.y) / (geometry.bottom - geometry.top);
  // The reference's desktop wheel uses one 10% step per event, independent of
  // device delta magnitude; the inverse step restores the same cursor anchor.
  const factor = gesture.deltaY < 0 ? .9 : 1/.9;
  Object.assign(result, transformedRange(geometry, axis, ratio, factor));
  if(pkg==='orderflow'&&gesture.ctrlKey&&region==='plot')Object.assign(result,transformedRange(geometry,'spot',ratio,factor));
  return result;
}

// geometry and view must be the pointer-down snapshot, not the last frame.
// Total drag delta then remains frame-rate independent and cannot accelerate.
export function panChartView(pkg, geometry, view, gesture = {}) {
  const result = copy(view);
  if (!validPlot(geometry) || !finite(gesture.dx) || !finite(gesture.dy)) return result;
  const region = gesture.region ?? 'plot', axis = axisFor(pkg, region, gesture.ctrlKey);
  if (!axis) return result;
  if (region === 'price-axis' || region === 'metric-axis') {
    Object.assign(result, transformedRange(geometry, axis, .5, Math.exp(clamp(gesture.dy * .005, -4, 4))));
    return result;
  }
  const [, , min, max] = rangeFor(geometry, axis);
  if (validRange(min, max)) Object.assign(result, transformedRange(geometry, axis, .5, 1, -gesture.dx / (geometry.right - geometry.left) * (max - min)));
  if (region === 'plot') {
    const verticalAxis = pkg === 'orderflow' ? 'metric' : 'price';
    const [, , low, high] = rangeFor(geometry, verticalAxis);
    if (validRange(low, high)) Object.assign(result, transformedRange(geometry, verticalAxis, .5, 1, gesture.dy / (geometry.bottom - geometry.top) * (high - low)));
  }
  return result;
}
