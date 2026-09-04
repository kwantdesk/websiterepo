# 2026-09-04 — Vultr recordings storage migration

## Prompt

> so what do i need to do?

The owner then provisioned and attached a 250 GB Chicago NVMe Block Storage
volume named `kwantdesk-recordings` to the production Vultr gateway.

## Diagnosis

The production gateway's 80 GB VM disk was the constrained filesystem, not
Vercel storage. Its root filesystem had only 1.7 GB free (98% used). The
Compose-managed `deploy_recordings` volume occupied 57 GB on that root disk
and contained the irreplaceable continuous Rithmic archive.

## Fix and outcome

- Positively identified the new empty 250 GB device by its Vultr mount ID and
  size before formatting it as ext4.
- Mounted it persistently at `/srv/kwantdesk-recordings` and changed the
  gateway from a root-disk Docker volume to that explicit host bind.
- Added deployment and boot guards: bootstrap refuses an absent or unwritable
  mount, and Docker declares `RequiresMountsFor=/srv/kwantdesk-recordings` so
  a reboot cannot silently start the recorder against the small root disk.
- Copied the archive while the feed remained live, ran a checksum sync, then
  stopped only the gateway for a final delta sync. The cutover ran from
  00:14:56Z to 00:15:06Z.
- Before restart, the stopped source and destination matched at 877 files and
  60,230,195,587 bytes, and a final rsync dry-run reported no pending change.
- After the bind-mounted gateway was confirmed healthy, removed only the
  verified obsolete `deploy_recordings` duplicate from the root disk.

## Production verification

- Public health reported Rithmic connected and authenticated on two probes;
  `lastMessageAt` advanced on both.
- NQ recording count advanced from 4,035 to 4,679 and ES from 2,222 to 2,525
  over five seconds. Recorder drops were empty and `lastError` was null.
- The gateway container resolves `/recordings` to the
  `/srv/kwantdesk-recordings` bind.
- Archive storage reports `ok`; the new filesystem has approximately 177 GiB
  available and is 25% used.
- The VM root filesystem fell from 98% used to 19% used, with approximately
  58 GiB available.
- Event-loop health was not overloaded after restart and reported a 1 ms
  maximum lag at verification time.

The block volume is same-region storage, not an off-box backup. Nightly
verified archival-object-storage replication remains required before public
launch.
