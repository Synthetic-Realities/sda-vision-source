// Pure exporter tests: no browser, uploads, or provider calls.
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(root, 'frontend/package.json'));
const { build } = frontendRequire('esbuild');
(async () => {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'sda-export-test-'));
  fs.mkdirSync(out, { recursive: true });
  const bundle = path.join(out, 'session-export.cjs');
  await build({ entryPoints: [path.join(root, 'frontend/src/sessionExport.ts')], bundle: true, platform: 'node', target: 'node20', format: 'cjs', outfile: bundle, loader: { '.ttf': 'binary', '.png': 'binary' }, logLevel: 'silent' });
  const oldFetch = global.fetch;
  global.fetch = async bytes => { assert(bytes instanceof Uint8Array, 'Only bundled local export assets may be fetched'); return new Response(bytes); };
  try {
    const { buildSessionExport } = require(bundle);
    const record = JSON.parse(fs.readFileSync(path.join(root, 'showcase-cache/reports/podcast.json'), 'utf8'));
    const before = JSON.stringify(record);
    for (const format of ['pdf', 'pptx', 'csv']) {
      const blob = await buildSessionExport([record], format);
      assert(blob.size > 100);
      fs.writeFileSync(path.join(out, 'podcast.' + format), Buffer.from(await blob.arrayBuffer()));
    }
    assert.equal(JSON.stringify(record), before, 'Export must not change the saved record');
    const complex = structuredClone(record); complex.meta.filename = 'Unsupported glyph 漢.pdf';
    await assert.rejects(buildSessionExport([complex], 'pdf'), /Choose CSV/);
    assert((await buildSessionExport([complex], 'csv')).size > 100);
    console.log(JSON.stringify({ podcast: ['pdf', 'pptx', 'csv'], originalUnchanged: true, unsupportedGlyphGuard: 'passed', output: out }));
  } finally { global.fetch = oldFetch; }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
