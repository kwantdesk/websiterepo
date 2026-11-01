"""Consistent, root-private support backups; no ticket bodies in logs."""
import datetime
import pathlib
import sqlite3

source = pathlib.Path('/var/lib/kwantdesk-support/support.db')
target = pathlib.Path('/var/backups/kwantdesk-support')
target.mkdir(mode=0o700, parents=True, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
destination = target / ('support-' + stamp + '.sqlite')
if not source.is_file():
    raise RuntimeError('Support database is not present; refusing an empty backup')
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src, sqlite3.connect(destination) as dst:
    src.backup(dst)
    if dst.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
        raise RuntimeError('Support backup did not pass integrity verification')
destination.chmod(0o600)
for stale in sorted(target.glob('support-*.sqlite'))[:-14]:
    if stale.parent.resolve() == target.resolve() and not stale.is_symlink():
        stale.unlink()
print('Support backup completed.')
