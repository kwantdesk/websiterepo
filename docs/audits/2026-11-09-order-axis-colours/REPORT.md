# Uniform trade price labels — 9 November 2026

The price-scale badges used level.color (side/SL/TP line colours) while the draggable on-chart labels used paperLabelInk/paperLabelText (shared contrast colours). Thus a monochrome sell entry and SL could be grey while TP was white.

Changed the shared price-scale rendering for all open-position, working-order and placement-preview levels to the same paperLabelInk/paperLabelText as the grab handles. No level prices, drag logic, protection triggers, fill rules, line colours or existing orders changed. Dark charts use white badges/dark text; light charts use dark badges/light text through the existing contrast function.

Actual Chart browser fixture verifies six badges (entry, SL, TP for an open position and a working order) match the computed grab-handle background and text colours in dark, light and purple chart backgrounds. Zero browser errors. Existing six paper-fill marker checks pass. Full isolated Next.js webpack production build, TypeScript and static page generation pass; receipt remains local after release verification.
