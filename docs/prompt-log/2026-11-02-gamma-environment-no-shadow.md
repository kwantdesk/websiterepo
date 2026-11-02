# Gamma Environment: remove shadow

Owner requested removal of the shadow behind the chart Gamma Environment indicator. Removed both the Tailwind shadow class and the inline colour glow from the shared Chart renderer, covering positive, negative and neutral regimes in live/replay charts. No changes to data, colours, scale or placement.

Validation: inspect the exact scoped diff and complete a production build. Release through the existing main-only websiterepo-yfmi integration; verify Ready and public commit. No market-data restart.
