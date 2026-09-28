// Editorial states and responsive layout. All API requests are intercepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.review-cache/governance-language-2026-09-24/browser');
fs.mkdirSync(out, { recursive: true });
const disabled = { configured: false, state: 'disabled', model: 'fixture' };
const report = {
  meta: { tool: 'SDA Vision', version: 'fixture', report_id: 'governance-fixture',
    filename: 'fixture.pdf', kind: 'pdf', frame_count: 1, frames_found: 1,
    generated_at: '2026-09-24', elapsed_ms: 1, models: [], notes: [], input_sha256: 'a'.repeat(64) },
  consensus: { overall_rating: 50, overall_verdict: 'inconclusive', headline: 'Inconclusive',
    confidence: 'low', agreement: 'single model', explanation: 'A corroborated panel result is unavailable for this run.',
    supporting: [], not_decisive: [], decision_trace: [], visible_text: '', vaccine_codes: [],
    disclaimer: 'Research assessment. Review alongside source information and context.' },
  providers: [], frames: [],
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      requests.push(url.pathname);
      let body;
      if (url.pathname === '/api/providers') body = { tool: 'SDA Vision', version: 'fixture', dev_mode: true,
        vaccine_lens: false, corpus_available: false, claude: disabled, openai: disabled,
        gemini: disabled, c2pa: disabled, synthid: disabled, local: disabled };
      else if (url.pathname === '/api/examples') body = { files: [] };
      else if (url.pathname === '/api/corpus') body = { available: false, labels: [] };
      else if (url.pathname === '/api/analyse') body = report;
      else if (url.pathname === '/api/diffusion') body = { source: 'item', nodes: [], edges: [],
        stats: { nodes: 0, edges: 0, clusters: 0, largest_cluster: 0 } };
      else throw new Error(`Unexpected API: ${url.pathname}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8100');
    await page.evaluate(() => { localStorage.setItem('sda-theme', 'console'); document.documentElement.dataset.theme = 'console'; });
    const input = page.locator('input[type=file]').first();
    await input.setInputFiles(path.join(root, 'examples/Digital_Vaccine_Intelligence.pdf'));
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    await page.getByRole('heading', { name: 'Inconclusive', exact: true }).waitFor();
    const text = await page.locator('body').innerText();
    assert(text.includes('No supporting findings are listed for this assessment.'));
    assert(text.includes('No additional findings are listed.'));
    assert(text.includes('Not a calibrated probability.'));
    assert(text.includes('A tool error means the check was not completed.'));
    assert(text.includes('For a multiple-image error, try one frame per message.'));
    assert(text.includes('first 4,000 characters to Anthropic'));
    assert(!text.includes('Every signal aligned') && !text.includes('means too many files'));
    const note = 'Historical researcher wording: never rewrite this note.';
    await page.locator('.so-paste textarea').first().fill(note);
    assert.equal(await page.locator('.so-paste textarea').first().inputValue(), note);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.locator('.results-panel').screenshot({ path: path.join(out, `sources-${width}.png`) });
    }

    report.meta = { ...report.meta, kind: 'audio', filename: 'fixture.wav', report_id: 'audio-copy-fixture' };
    report.audio_inspection = { status: 'present', stream_count: 1, method_version: 'audio-local-v1',
      input_sha256: report.meta.input_sha256, synthetic_audio_assessed: false, notes: [],
      provenance_scope: 'Credential coverage of this audio track: unresolved.',
      tracks: [{ index: 0, codec: 'pcm_s16le', channels: 1, sample_rate: 16000,
        duration_seconds: 20, decode_status: 'failed', samples: [] }] };
    report.audio_assessment = { status: 'unconfigured', model: 'fixture', provider: 'Google Gemini',
      observations: [], limitations: [], content_type: 'unclear', track_index: 0, start_seconds: 0, duration_seconds: 20 };
    report.suno_check = { status: 'error', verdict: null, http_status: 503,
      note: "Suno's check could not be completed (HTTP 503). Provenance remains unresolved by this check." };
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Soundtrack and vendor checks' });
    await panel.getByText('Partial', { exact: true }).waitFor();
    await panel.getByText('Unavailable', { exact: true }).waitFor();
    await panel.getByText('Error', { exact: true }).waitFor();
    await panel.getByText('No usable result', { exact: true }).waitFor();
    await panel.getByText('Optional checks', { exact: true }).click();
    const google = panel.getByRole('checkbox', { name: /I agree to send up to 20 seconds/ });
    const suno = panel.getByRole('checkbox', { name: /I agree to send the complete original/ });
    assert.equal(await google.isChecked(), false);
    assert.equal(await suno.isChecked(), false);
    const consent = await panel.locator('.audio-actions').innerText();
    for (const phrase of ['Google Gemini', 'configured API account', 'terms and charges',
      'complete original file', 'video, audio and embedded metadata', "Suno's terms"]) assert(consent.includes(phrase));
    assert.equal(await panel.getByRole('button', { name: 'Assess audio excerpt' }).isDisabled(), true);
    assert.equal(await panel.getByRole('button', { name: 'Check original with Suno' }).isDisabled(), true);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await panel.screenshot({ path: path.join(out, `audio-${width}.png`) });
    }
    assert(!requests.some(url => /opinion-score|audio\/assess|suno\/check/.test(url)));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, cloudCalls: 0, screenshots: out, states: ['inconclusive', 'empty', 'partial', 'unconfigured', 'error'] }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
