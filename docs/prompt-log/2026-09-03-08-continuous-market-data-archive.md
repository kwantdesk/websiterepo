# Prompt

we had a system that would record every single bit of info quantdata gives us and rithmic gives us the full book when it comes in 24/7 we save it somewhere so in the future we have full hisotorical to look back and reply.... this is important this is running 24//7 without dropping out or having gaps, need his done properly, claude said it did it but you never know witht that fucker

# Answer

Audited against the live VPS rather than trusting the implementation claim.
The production Rithmic session was connected/authenticated, its timestamp and
recorder counts advanced, eleven instruments were populated, and writer drops
were zero. The container uses restart-always plus autoheal and the archive is
on a persistent Docker volume.

Two silent coverage defects were fixed: unmapped Rithmic market messages kept
their bytes inside the decoder but lost them at the recorder event boundary;
three direct QuantData clients bypassed the otherwise central response
archive; and planned collector restarts did not write the GAP marker used for
unplanned disconnects. Unmapped Rithmic wire bytes now reach disk, and the live QuantData
snapshot stream, cash/index history service and daily cash-index collector now
archive every successful provider response alongside the request that produced
it. Every future shutdown marks the unobserved interval explicitly, and
`/health.archiveStorage` now makes archive disk exhaustion visible.

Verified by the 309-test gateway suite plus focused syntax and archive tests.
Deployed to the VPS and checked against the live archive after restart.

The VM deploy health probe now runs inside the gateway container. Port 8793 is
intentionally private to Docker, so the old host-side curl waited through the
entire timeout and printed an empty result even after a successful deployment.

The live audit also caught retired Databento and Massive credentials being
silently resurrected on every deployment by the credential-preservation
helper. Preservation is now limited to QuantData and internal services; the
retired provider credentials were removed from production and cannot return on
the next release.

Unfinished external requirement: the 80 GB VPS disk is 92% full (5.8 GB free),
the archive is 52 GB, and there is no off-box backup target or credential on
the server. Indefinite retention cannot be truthfully guaranteed until an
S3-compatible bucket/credential or larger attached storage is supplied. No
recording was deleted and no pretend retention policy was installed.
