# Remove Show Source controls

Removed generic Show Source and VIX Data source switches, Gamma/VIX badge source-label rendering, and their default flags. Stored indicator normalization removes old showSource flags; generic Style also excludes that key for imported/live settings. The confluence calculation toggle is labelled Contributing levels, avoiding confusing it with provider attribution. Data source selection and underlying calculations remain intact.

Validation: source search and scoped diff review, followed by a final full production build. Deploy once through main to websiterepo-yfmi and verify Ready plus the public commit. No VPS changes or feed interruption.
