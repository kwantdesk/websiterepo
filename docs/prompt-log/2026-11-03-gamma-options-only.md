# Gamma Environment: options underlyings only

Owner corrected the futures choices in the preceding release. The calculator picker now contains only NDX, QQQ, SPX, SPXW and SPY. ES, NQ and Automatic are removed. Default is explicitly SPX, shown on the badge. Every calculator source resolves directly to an options frame; it no longer falls through to the chart's futures overlay. Legacy NQ/MNQ selections migrate to NDX; ES/MES, AUTO and unsupported selections migrate to SPX. Existing valid options choices are preserved. Other gamma conversion/level features are unchanged.

Three functional tests check the exact five-source list, routing, legacy migration and saved settings. The actual headless badge/settings interaction check additionally asserts the entire dropdown contains exactly those five choices. Scoped library lint, complete production build, one main/yfmi deployment and exact live commit verification are the release gates. No VPS restart or data changes.
