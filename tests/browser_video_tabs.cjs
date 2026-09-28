// Provider calls are mocked; only the local graph/summary endpoints run for real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.review-cache/audio-workflow-2026-09-24/video-tabs');
fs.mkdirSync(out, { recursive: true });
const buffer = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=teal:s=160x120:r=1',
  '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1']);
const hash = createHash('sha256').update(buffer).digest('hex');
const disabled = { configured: false, state: 'disabled', model: 'fixture' };
const original = {
  meta: { tool: 'SDA Vision', version: 'fixture', generated_at: '2026-09-24', report_id: 'video-tabs-1',
    input_sha256: hash, kind: 'video', filename: 'fixture.mp4', models: ['fixture'], notes: ['Fixture only.'],
    frame_count: 4, frames_found: 4, elapsed_ms: 1 },
  providers: ['claude', 'openai', 'gemini'].map(id => ({ id, name: `${id} Vision`, kind: 'vision',
    status: 'ok', verdict: 'synthetic_likely', rating: 85, confidence: 'low', model: 'fixture',
    summary: 'Fixture only.', evidence: [], raw: {} })),
  frames: ['00:01', '00:02', '00:03', '00:04'].map(frame => ({ frame, verdict: 'synthetic_likely', rating: 85 })),
  consensus: { overall_rating: 85, overall_verdict: 'synthetic_likely', confidence: 'low',
    headline: 'Fixture visual result', explanation: 'Fixture only.', agreement: 'fixture',
    supporting: [], not_decisive: [], decision_trace: [], visible_text: '', vaccine_codes: [] },
  audio_inspection: { status: 'present', stream_count: 1, method_version: 'audio-local-v1', input_sha256: hash,
    synthetic_audio_assessed: false, provenance_scope: 'Track scope not established.', notes: ['Not AI detection.'],
    tracks: [{ index: 1, codec: 'aac', channels: 2, sample_rate: 48000, duration_seconds: 25,
      decode_status: 'decoded', samples: [{ start_seconds: 0, duration_seconds: 3, peak_dbfs: -20,
        signal_above_minus_60_dbfs: true }] }] },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], calls = [], graphs = [];
    let analyses = 0;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname === '/api/diffusion' || url.pathname === '/api/diffusion/summary') {
        if (url.pathname === '/api/diffusion') graphs.push(req.postDataJSON());
        return route.continue();
      }
      let body;
      if (url.pathname === '/api/providers') body = { tool: 'SDA Vision', version: 'fixture', dev_mode: true,
        vaccine_lens: false, corpus_available: false, claude: disabled, openai: disabled,
        gemini: disabled, synthid: disabled, c2pa: disabled, local: disabled };
      else if (url.pathname === '/api/examples') body = { files: [] };
      else if (url.pathname === '/api/corpus') body = { available: false, labels: [] };
      else if (url.pathname === '/api/analyse') {
        body = structuredClone(original);
        body.meta.report_id = `video-tabs-${++analyses}`;
        if (analyses === 2) Object.assign(body.audio_inspection, { status: 'absent', stream_count: 0, tracks: [] });
        if (analyses === 3) body.audio_inspection = undefined;
        if (analyses === 4) Object.assign(body.audio_inspection, { status: 'error', stream_count: null, tracks: [] });
      } else if (url.pathname === '/api/audio/assess') {
        calls.push('google');
        assert.match(req.postDataBuffer().toString('latin1'), /name="consent_to_google"\r\n\r\ntrue/);
        body = { status: 'ok', input_sha256: hash, excerpt_sha256: 'b'.repeat(64), provider: 'Google Gemini',
          model: 'fixture', prompt_version: 'soundtrack-content-v1', checked_at: '2026-09-24', track_index: 1,
          start_seconds: 0, duration_seconds: 20, consent_to_google: true, synthetic_audio_assessed: false,
          content_type: 'music', observations: ['Instrumental music.'], transcript_excerpt: '', limitations: ['Excerpt only.'] };
      } else if (url.pathname === '/api/suno/check') {
        calls.push('suno');
        assert.match(req.postDataBuffer().toString('latin1'), /name="consent_to_suno"\r\n\r\ntrue/);
        body = { status: 'ok', input_sha256: hash, provider: 'Suno Credentials', endpoint: 'fixture',
          checked_at: '2026-09-24', consent_to_suno: true, submitted_original: true,
          verdict: 'verified_suno', http_status: 200, response_sha256: 'c'.repeat(64), note: 'Vendor only.' };
      } else throw new Error(`Unexpected API: ${url.pathname}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8100');
    await page.evaluate(() => { localStorage.setItem('sda-theme', 'console'); document.documentElement.dataset.theme = 'console'; });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload single file', exact: true }).click();
    await (await chooser).setFiles({ name: 'fixture.mp4', mimeType: 'video/mp4', buffer });
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    const visual = page.getByRole('tab', { name: 'Visuals', exact: true });
    const audio = page.getByRole('tab', { name: 'Audio (1 track)', exact: true });
    await visual.waitFor();
    assert.equal(await visual.getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('region', { name: 'Soundtrack and vendor checks' }).count(), 0);
    await page.locator('.results-panel').screenshot({ path: path.join(out, 'visual-desktop.png') });
    await visual.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await audio.getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('heading', { name: 'Fixture visual result' }).count(), 0);
    const panel = page.getByRole('region', { name: 'Soundtrack and vendor checks' });
    await panel.getByRole('table').waitFor();
    assert.deepEqual(calls, []);
    await page.locator('.results-panel').screenshot({ path: path.join(out, 'audio-desktop.png') });
    await panel.getByText('Optional checks', { exact: true }).click();
    const assess = panel.getByRole('button', { name: 'Assess audio excerpt', exact: true });
    assert.equal(await assess.isDisabled(), true);
    await panel.getByRole('checkbox', { name: /I agree to send up to 20 seconds/ }).check();
    await assess.click();
    await page.locator('.graph-svg').getByRole('button', { name: 'Gemini audio content', exact: true }).waitFor();
    await panel.getByRole('checkbox', { name: /I agree to send the complete original/ }).check();
    await panel.getByRole('button', { name: 'Check original with Suno', exact: true }).click();
    const sunoNode = page.locator('.graph-svg').getByRole('button', { name: 'Suno Credentials', exact: true });
    await sunoNode.waitFor();
    assert.equal(await sunoNode.getAttribute('fill'), '#1b878a');
    await sunoNode.focus(); await page.keyboard.press('Enter');
    await page.locator('.graph-info').getByText('Unscored observation', { exact: true }).waitFor();
    assert.equal(await page.locator('.graph-svg line[stroke-dasharray]').count(), 3);
    await page.getByRole('button', { name: 'Plain-English summary', exact: true }).click();
    await page.locator('.graph-story').getByText(/Suno Credentials \(ok; Vendor reports verified_suno\)/).waitFor();
    assert((await page.locator('.graph-story').innerText()).includes('Three visual LLMs'));
    assert.equal(graphs.at(-1).reports[0].consensus.overall_rating, 85);
    await page.locator('.diffusion-panel').screenshot({ path: path.join(out, 'graph-desktop.png') });
    await panel.getByText('Optional checks', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.locator('.results-panel').screenshot({ path: path.join(out, 'audio-mobile.png') });
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    await page.getByRole('tab', { name: 'No audio track', exact: true }).waitFor();
    assert.equal(await visual.getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'No audio track', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Assess audio excerpt', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    await page.getByRole('tab', { name: 'Audio unchecked', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Run analysis', exact: true }).click();
    await page.getByRole('tab', { name: 'Audio unknown', exact: true }).click();
    await panel.getByRole('table').getByText('Audio presence unknown', { exact: true }).waitFor();
    assert.deepEqual(calls, ['google', 'suno']);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, cloudCalls: 0, realLocalGraph: true, analyses, screenshots: out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
