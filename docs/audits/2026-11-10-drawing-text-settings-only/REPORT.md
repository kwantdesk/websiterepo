# Drawing text: settings only

Owner requested removal of the floating Add text control after selection. Removed its import, selection lookup and mount from the shared ChartDrawLayer. Drawing settings still expose the Text tab and text entry; double-click/double-tap settings routing is unchanged. Existing drawing text and labels are preserved. Native text/note creation tools remain available.

Updated the existing actual-component browser regression to use ChartDrawSettings through the drawing's actual double-click target. Eight drawing families pass: trend line, rectangle, horizontal line, vertical line, polyline, ellipse, Fibonacci retracement and long position. Each single selection has no floating editor; double-click opens settings; editing text updates and preserves the visible label after closing. Zero browser errors.

Scoped release only. No feed restart, owner tab refresh, order, account or workspace mutation. Full isolated webpack production build/TypeScript/static generation checked before release.
