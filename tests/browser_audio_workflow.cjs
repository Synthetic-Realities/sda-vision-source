// Local fixture replay: all API requests intercepted, no provider uploads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.review-cache/audio-workflow-2026-09-24/browser');
fs.mkdirSync(out, { recursive: true });
const buffer = Buffer.alloc(44 + 32000);
buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(16000, 24); buffer.writeUInt32LE(32000, 28); buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(32000, 40);
const hash = createHash('sha256').update(buffer).digest('hex');
const initial = {
  meta: { tool: 'SDA Vision', version: 'fixture', generated_at: '2026-09-24', report_id: 'audio-1',
    input_sha256: hash, kind: 'audio', filename: 'fixture.wav', models: [], notes: [], frame_count: 0, elapsed_ms: 1 },
  providers: [], frames: [],
  consensus: { overall_rating: null, overall_verdict: 'inconclusive', confidence: 'low',
    headline: 'Fixture audio result', explanation: 'No acoustic origin conclusion.', agreement: 'fixture',
    supporting: [], not_decisive: [], decision_trace: [], visible_text: '', vaccine_codes: [] },
  audio_inspection: { status: 'present', stream_count: 1, method_version: 'audio-local-v1', input_sha256: hash,
    synthetic_audio_assessed: false, provenance_scope: 'Original container; track scope not established.',
    notes: ['Sampled energy is not AI detection.'], tracks: [{ index: 0, codec: 'pcm_s16le', channels: 1,
      sample_rate: 16000, duration_seconds: 1, decode_status: 'decoded', samples: [{ start_seconds: 0,
        duration_seconds: 1, peak_dbfs: null, signal_above_minus_60_dbfs: false }] }] },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], calls = [];
    let analyses = 0;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      let body;
      const disabled = { configured: false, state: 'disabled', model: 'fixture' };
      if (url.pathname === '/api/providers') body = { tool: 'SDA Vision', version: 'fixture',
        dev_mode: true, vaccine_lens: false, corpus_available: false, claude: disabled,
        openai: disabled, gemini: disabled, synthid: disabled, c2pa: disabled, local: disabled };
      else if (url.pathname === '/api/examples') body = { files: [] };
      else if (url.pathname === '/api/corpus') body = { available: false, labels: [] };
      else if (url.pathname === '/api/analyse') body = { ...initial, meta: { ...initial.meta, report_id: `audio-${++analyses}` } };
      else if (url.pathname === '/api/diffusion') body = { source: 'item', nodes: [], edges: [], stats: { nodes: 0, edges: 0, clusters: 0, largest_cluster: 0 } };
      else if (url.pathname === '/api/audio/assess') {
        calls.push('audio');
        const post = req.postDataBuffer().toString('latin1');
        assert.match(post, /name="consent_to_google"\r\n\r\ntrue/);
        assert(post.includes(hash));
        body = { status: 'ok', input_sha256: hash, excerpt_sha256: 'b'.repeat(64), provider: 'Google Gemini',
          model: 'fixture-model', checked_at: '2026-09-24', prompt_version: 'soundtrack-content-v1',
          track_index: 0, start_seconds: 0, duration_seconds: 1, consent_to_google: true,
          synthetic_audio_assessed: false, content_type: 'unclear', observations: ['No speech audible in fixture.'],
          transcript_excerpt: '', limitations: ['Not an AI-origin detector.'] };
      } else if (url.pathname === '/api/suno/check') {
        calls.push('suno');
        assert.match(req.postDataBuffer().toString('latin1'), /name="consent_to_suno"\r\n\r\ntrue/);
        body = { status: 'ok', input_sha256: hash, provider: 'Suno Credentials', endpoint: 'fixture',
          checked_at: '2026-09-24', consent_to_suno: true, submitted_original: true,
          verdict: 'verified_suno', http_status: 200, response_sha256: 'c'.repeat(64),
          note: 'Vendor-reported result; no score change.' };
      } else throw new Error(`Unexpected API: ${url.pathname}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8100');
    await page.evaluate(() => { localStorage.setItem('sda-theme', 'console'); document.documentElement.dataset.theme = 'console'; });
    const choose = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload single file', exact: true }).click();
    await (await choose).setFiles({ name: 'fixture.wav', mimeType: 'audio/wav', buffer });
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    await page.getByRole('heading', { name: 'Fixture audio result' }).waitFor();
    const panel = page.getByRole('region', { name: 'Soundtrack and vendor checks' });
    await panel.getByText('Optional checks', { exact: true }).click();
    const audio = panel.getByRole('button', { name: 'Assess audio excerpt', exact: true });
    const suno = panel.getByRole('button', { name: 'Check original with Suno', exact: true });
    assert.equal(await audio.isDisabled(), true);
    assert.equal(await suno.isDisabled(), true);
    assert.deepEqual(calls, []);
    await panel.getByRole('checkbox', { name: /I agree to send up to 20 seconds/ }).check();
    await audio.click();
    await panel.getByRole('table').getByText('No speech audible in fixture.').waitFor();
    assert.equal(await audio.isDisabled(), true);
    assert.equal(await suno.isDisabled(), true);
    await panel.getByRole('checkbox', { name: /I agree to send the complete original/ }).check();
    await suno.click();
    await panel.getByText('Suno reports verified Suno provenance', { exact: true }).waitFor();
    assert.equal(await suno.isDisabled(), true);
    assert.deepEqual(calls, ['audio', 'suno']);
    await page.getByRole('heading', { name: 'Fixture audio result' }).waitFor();
    await panel.screenshot({ path: path.join(out, 'desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await panel.screenshot({ path: path.join(out, 'mobile.png') });
    await panel.getByRole('checkbox', { name: /I agree to send the complete original/ }).check();
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.audio-observation'));
    await panel.getByText('Optional checks', { exact: true }).click();
    assert.equal(await suno.isDisabled(), true);
    assert.deepEqual(calls, ['audio', 'suno']);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, cloudCalls: 0, mockedOptionalRequests: calls,
      consentResetOnNewReport: true, screenshots: out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
