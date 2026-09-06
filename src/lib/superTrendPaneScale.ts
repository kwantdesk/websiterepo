import type { CalculatedIndicatorSeries } from "./chartIndicatorEngine";

type Domain = { min: number; max: number };

/** Only pending Super Trend panes opt in; established study domains are untouched. */
export class SuperTrendPaneScale {
  private scope: string | undefined;
  private domains = new Map<string, Domain>();

  retain(scope: string | undefined, keys: readonly string[]) {
    if (scope !== this.scope) { this.domains.clear(); this.scope = scope; }
    const keep = new Set(keys);
    for (const key of this.domains.keys()) if (!keep.has(key)) this.domains.delete(key);
  }

  reset(key: string) { return this.domains.delete(key); }

  resolve(key: string, series: CalculatedIndicatorSeries[], calculate: (series: CalculatedIndicatorSeries[]) => Domain): Domain {
    if (!series.length || !series.every(s => Boolean(s.superTrendStyleKey))) return calculate(series);
    const excluded = series.every(s => s.excludeFromAutoScale);
    const previous = this.domains.get(key);
    if (excluded && previous) return previous;
    // On first load with auto-centre already off, establish a useful baseline
    // from real values once. A generic -1..1 fallback can hide a price study.
    const domain = calculate(excluded ? series.map(s => ({ ...s, excludeFromAutoScale: false })) : series);
    if (series.some(s => s.data.some(p => Number.isFinite(p.value)))
      && Number.isFinite(domain.min) && Number.isFinite(domain.max) && domain.max > domain.min) {
      this.domains.set(key, domain);
    }
    return domain;
  }
}
