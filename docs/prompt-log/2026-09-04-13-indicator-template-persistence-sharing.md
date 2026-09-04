# Indicator template persistence and sharing

## User request

Make indicator templates persist for the signed-in user, make Export create a real file, and make Import open the user's files and support templates shared between KwantDesk users.

## Diagnosis

- The universal indicator template store lived only in browser storage and was absent from the signed-in account preference snapshot.
- A template save emitted only an in-page refresh event, so it did not trigger the account upload hook.
- Universal Export copied JSON to the clipboard instead of downloading a file.
- Universal Import applied settings temporarily but did not save the imported template.
- Open settings panels did not refresh their template lists after asynchronous account hydration.
- The volume-profile template loader was attached to the TPO dialog path instead of the volume-profile path.
- Older footprint and volume-profile save paths could update the UI even when browser storage rejected the write.

## Fix and outcome

- Added universal, footprint, TPO and GEX interval template stores to account preference sync; the existing volume-profile store remains included.
- Added a same-account migration that merges pre-existing browser-only templates into an older cloud snapshot without crossing account boundaries or overwriting newer unrelated cloud settings.
- Every universal and footprint save/delete now triggers the preference upload event.
- Universal Export downloads a versioned `.kwantdesk.json` file with a safe filename.
- Import opens the native file picker, validates file type/version/indicator ownership/size, saves the imported template, selects it and applies it.
- Template lists refresh when signed-in preferences hydrate, including specialized volume-profile, footprint, TPO and GEX preset lists.
- Volume-profile and footprint panels now report storage failures rather than claiming an unsuccessful save/delete/import worked.

## Verification

- `npm run test:indicator-templates` — 16/16 passed.
- `npm run test:preference-hydration` — passed, including legacy-template migration into a newer cloud snapshot.
- `npm run test:browser-storage-quota` — 10/10 passed.
- `npm run test:storage-writes-guarded` — 4/4 passed.
- `npx tsc --noEmit` — passed.
- Scoped ESLint on all changed source and test files — passed with no warnings.
- `npm run build` — production build passed (80/80 static pages generated).
