# Remove Annotations Overlay

Owner requested removing the Annotations Overlay indicator. Removed its library entry, settings, live/render/replay supported IDs and chart mirroring integration. Old saved indicator instances normalize disabled. Removed the associated per-chart annotation registry publish/subscribe activity; normal drawings and other chart studies are unchanged. The unused registry utility remains in source for archival reference.

Validation: scoped diff review/source search, full production build; release once through main to websiterepo-yfmi, verify Ready and matching public commit. No feed restart.
