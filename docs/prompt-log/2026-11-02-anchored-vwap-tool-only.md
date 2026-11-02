# Anchored VWAP: drawing tool only

Owner explicitly requested removing Anchored VWAP from chart indicators, keeping the drawing tool. Removed its catalog entry, rendered/supported indicator IDs and indicator-library add shortcut. The actual anchoredVwap drawing engine, left toolbar entries and saved drawings are untouched; other VWAP indicators remain.

Validation: scoped source diff and full production build. One scoped main push to websiterepo-yfmi, then Ready/public commit verification. No market-data service changes.
