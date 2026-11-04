const fs = require('fs'), { spawnSync } = require('child_process');
const catalogue = JSON.parse(fs.readFileSync('docs/audits/2026-11-04-indicator-controls/controls.json'));
const folder = 'docs/audits/2026-11-04-indicator-controls';
const results = [];
for (const def of catalogue) {
    const start = Date.now();
    const result = spawnSync(process.execPath, ['scripts/audits/indicator-dialog-worker.cjs'], { env: { ...process.env, AUDIT_ONLY: def.id }, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
    fs.writeFileSync('tmp/dialog-' + def.id + '.log', (result.stdout ?? '') + '\n' + (result.stderr ?? ''));
    const file = folder + '/dialog-detail/' + def.id + '.json';
    let record;
    try {
        record = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch { }
    results.push({ id: def.id, name: def.name, category: def.category, exitCode: result.status, timeout: result.error?.code === 'ETIMEDOUT', milliseconds: Date.now() - start, record });
    fs.writeFileSync(folder + '/dialog-interactions.json', JSON.stringify(results, null, 2));
    console.log(results.length + '/' + catalogue.length, def.id, record?.indicators?.[0]?.checks.length ?? 0, 'checks', result.status);
}
