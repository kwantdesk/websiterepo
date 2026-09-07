# Private terminology scrub

## Prompt

Remove Menthroq, Trinity, Bookmap, QuantData, Databento, Rithmic and Skylit anywhere they can be seen on the site because those names expose private implementation information.

## Diagnosis

The names appeared in static labels and descriptions, dynamically returned feed/error text, accessibility attributes, browser notifications, account screens and a same-origin embedded liquidity application. Internal transport identifiers also legitimately use several names and cannot be blindly renamed without breaking live integrations.

## Fix

- Added one case-insensitive public-copy sanitizer with whole-word matching, so ordinary text such as `logarithmic` is not damaged.
- Mounted a global presentation privacy guard in the root layout. It scrubs rendered text, titles, placeholders, alt/ARIA labels, future DOM mutations and same-origin embedded applications.
- Replaced known stock account/authorization copy, the Shift Candle alert defaults and the liquidity-map loading message at source.
- Left internal API paths, provider enums, credentials and transport contracts unchanged.

## Outcome

The private names no longer appear on user-visible Kwant Desk surfaces, including late-arriving status and error messages, while the underlying data connections continue using their existing contracts.
