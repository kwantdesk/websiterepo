# Market Profile (TPO) catalogue correction

## Prompt

Work through every pending indicator honestly and do not leave non-working
Pending entries in the library.

## Fixed

`Market Profile (TPO)` was not a separate indicator contract. It duplicated
the already released `TPO Daily` / `tpo-chart` study while its display-derived
ID missed every engine and renderer gate. The duplicate row is removed and the
legacy ID now canonicalizes to `tpo-chart`, including favourites and restored
workspaces. Existing `normalizeStoredIndicator` migration remains in place.

## Outcome

The library contains one complete daily TPO study instead of one working row
and one misleading Pending copy. Catalogue pending falls from 14 to 13 without
claiming or creating a second calculation.

