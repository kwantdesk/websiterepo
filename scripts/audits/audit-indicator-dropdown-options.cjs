const fs = require('fs'), { spawnSync } = require('child_process');
const definitions = JSON.parse(fs.readFileSync('docs/audits/2026-11-04-indicator-controls/controls.json'));
const result = [];
for (const def of definitions) {
    const r = spawnSync(process.execPath, ['scripts/audits/indicator-dialog-worker.cjs'], { env: { ...process.env, AUDIT_ONLY: def.id, AUDIT_DROPDOWNS_ONLY: '1', AUDIT_ALL_OPTIONS: '1', AUDIT_OUTPUT_SUFFIX: '-options' }, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 1024 });
    console.log(def.id, r.status);
    const file = 'docs/audits/2026-11-04-indicator-controls/dialog-detail/' + def.id + '-options.json';
    result.push({ id: def.id, exitCode: r.status, record: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null });
    fs.writeFileSync('docs/audits/2026-11-04-indicator-controls/dropdown-option-interactions.json', JSON.stringify(result, null, 2));
}
