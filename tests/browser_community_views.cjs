// Presentation-layer checks only. Every API request is intercepted; no provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, process.env.COMMUNITY_OUTPUT || '.review-cache/community-views-2026-09-24');
fs.mkdirSync(out, { recursive: true });
const base = process.env.COMMUNITY_URL || 'http://127.0.0.1:5173';
const image = fs.readFileSync(path.join(root, 'frontend/src/assets/community-illustration.png'));
const thumb = `data:image/png;base64,${image.toString('base64')}`;
const ready = { configured: true, state: 'ready', model: 'fixture-model' };
const providerInfo = { tool: 'SDA Vision', version: 'test', dev_mode: true, vaccine_lens: true,
  corpus_available: false, claude: ready, openai: ready, gemini: ready, c2pa: ready, local: ready,
  synthid: { configured: false, state: 'pending', model: '' } };
let kind = 'image', filename = 'workshop-example.png', fail = false, analyses = 0;
const scoreRequests = [], graphRequests = [];

function report() {
  return {
    meta: { tool: 'SDA Vision', version: 'test', report_id: `workshop-${analyses}`, input_sha256: 'a'.repeat(64),
      method_version: 'fixture-v1', generated_at: '2026-09-24T12:00:00Z', filename, kind, mode: 'general',
      frame_count: ['audio', 'text'].includes(kind) ? 0 : kind === 'image' ? 1 : 4, frames_found: 4,
      models: ['fixture-model'], notes: ['Mocked test record.'], elapsed_ms: 3, thumbnail: thumb },
    consensus: { overall_rating: 72, overall_verdict: 'synthetic_likely', confidence: 'medium',
      headline: 'Fixture assessment', explanation: 'Fixture readings suggest synthetic content; source review remains open.',
      agreement: 'fixture agreement', decision_trace: [], supporting: [], not_decisive: [],
      visible_text: 'Fixture transcript or image text.', vaccine_codes: [], disclaimer: 'Fixture research assessment.' },
    providers: [
      { id: 'claude', name: 'Claude Vision', kind: ['audio','text'].includes(kind) ? 'analysis' : 'vision', status: 'ok', rating: 72, verdict: 'synthetic_likely', model: 'fixture-model',
        summary: 'Fixture visual observation.', evidence: ['Repeated textures across separate areas.', 'Inconsistent object edges.', 'Lighting differs across the scene.', 'Repeated small details.', 'Unclear lettering.', 'Final evidence item kept in the disclosure.'], raw: {}, confidence: 'medium' },
      { id: 'openai', name: 'OpenAI Vision', kind: ['audio','text'].includes(kind) ? 'analysis' : 'vision', status: 'timeout', rating: 99, verdict: 'inconclusive', model: 'fixture-model',
        summary: 'Provider timed out.', evidence: [], raw: {} },
      { id: 'gemini', name: 'Gemini Vision', kind: ['audio','text'].includes(kind) ? 'analysis' : 'vision', status: 'disabled', rating: null, verdict: 'inconclusive', model: 'fixture-model',
        summary: 'Disabled for this test.', evidence: [], raw: {} },
      { id: 'c2pa', name: 'C2PA Content Credentials', kind: 'provenance', status: 'ok', rating: null, verdict: 'inconclusive',
        summary: kind === 'video' ? 'Integrity validated; signer trust remains unestablished.' : 'Embedded credentials: none found. Origin remains unresolved by this check.', evidence: [],
        raw: kind === 'video' ? { validation: { integrity: 'valid', trust: 'untrusted' }, active_manifest: 'fixture-manifest', declaration: 'Manifest declares AI-generated content.' }
          : { validation: { integrity: 'absent', trust: 'unknown' } } },
      { id: 'local', name: 'Local forensic cues', kind: 'forensic', status: 'ok', rating: 0, verdict: 'authentic_likely', model: null,
        summary: 'Fixture supporting observation.', evidence: [], raw: {}, confidence: 'low' },
    ],
    frames: ['audio','text'].includes(kind) ? [] : [{ frame: '00:01', rating: 72, verdict: 'synthetic_likely' }],
    ...(['video','audio'].includes(kind) ? { audio_inspection: { status: 'present', stream_count: 1, tracks: [], notes: [],
      synthetic_audio_assessed: false, provenance_scope: 'Audio-track coverage unresolved.', input_sha256: 'a'.repeat(64) } } : {}),
  };
}

async function mock(page, requests, errors, transform = value => value) {
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url());
    requests.push(url.pathname);
    let body;
    if (url.pathname === '/api/providers') body = providerInfo;
    else if (url.pathname === '/api/corpus') body = { available: false, labels: [] };
    else if (url.pathname === '/api/examples') body = { files: [{ name: 'workshop-example.png' }, { name: 'second-example.png' }] };
    else if (url.pathname === '/api/examples/file') return route.fulfill({ contentType: 'image/png', body: image });
    else if (url.pathname === '/api/examples/thumb') body = { thumb };
    else if (url.pathname === '/api/analyse') {
      assert.doesNotMatch(req.postData() || '', /My private first impression|Private discussion note|Private reflection note|PRIVATE SOURCE LEAD/);
      analyses++;
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Fixture service unavailable.' }) });
      body = transform(report());
    } else if (url.pathname === '/api/opinion-score') {
      scoreRequests.push(req.postDataJSON());
      body = { score: 66, read: 'Fixture note assessment' };
    } else if (url.pathname.startsWith('/api/export/')) {
      assert.equal(req.postDataJSON().report.meta.report_id, `workshop-${analyses}`);
      return route.fulfill({ contentType: 'text/plain', headers: { 'Content-Disposition': 'attachment; filename="fixture-report.md"' }, body: 'Fixture full research export' });
    } else if (url.pathname === '/api/diffusion') {
      graphRequests.push(req.postDataJSON());
      body = { source: 'item', nodes: [], edges: [], stats: { nodes: 0, edges: 0, clusters: 0, largest_cluster: 0 } };
    }
    else { errors.push(`Unexpected API: ${url.pathname}`); return route.fulfill({ status: 400, body: 'Unexpected API' }); }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function downloadText(page, button) {
  const formats = page.locator('.community-downloads select');
  if (await formats.count()) await formats.selectOption('csv');
  const waiting = page.waitForEvent('download');
  await button.click();
  const download = await waiting;
  const text = fs.readFileSync(await download.path(), 'utf8');
  if (!download.suggestedFilename().startsWith('sda-community-')) return text;
  return text.split('\r\n').map(line => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"')))
    .filter(row => row.length === 3).map(row => `${row[0]}\n${row[1]}: ${row[2]}`).join('\n');
}

module.exports = { mock, report };

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [], requests = [], checks = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('sda-theme', 'console'));
    await mock(page, requests, errors);
    await page.goto(base);
    assert.equal(await page.getByRole('radio', { name: 'Community Workshop', exact: true }).isChecked(), true);
    await page.getByRole('radio', { name: 'Developer', exact: true }).check();
    assert.equal(await page.getByRole('button', { name: 'Run analysis', exact: true }).isVisible(), true);
    await page.locator('.topbar').screenshot({ path: path.join(out, 'developer-header.png') });
    await page.locator('.input-panel').screenshot({ path: path.join(out, 'developer-input.png') });
    const developerBrand = await page.locator('.topbar .sda-wordmark').evaluate(e => {
      const s = getComputedStyle(e); return { colour: s.color, font: s.fontFamily, weight: s.fontWeight, size: s.fontSize };
    });
    if (process.env.VERIFY_DEVELOPER_BASELINE === '1') {
      const old = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      await old.addInitScript(() => localStorage.setItem('sda-theme', 'console'));
      await mock(old, [], errors);
      await old.goto('http://127.0.0.1:8100');
      await old.locator('.topbar .dev-badge').waitFor();
      for (const [selector, name] of [['.topbar', 'header'], ['.input-panel', 'input']]) {
        const before = await old.locator(selector).screenshot({ path: path.join(out, `developer-${name}-baseline.png`) });
        const after = await page.locator(selector).screenshot({ path: path.join(out, `developer-${name}.png`) });
        // A vertically shifted CSS gradient can differ by one channel value
        // through rasterisation. Compare pixels, not PNG compression bytes.
        const difference = JSON.parse(execFileSync(path.join(root, '.venv/bin/python'), ['-c',
          'from PIL import Image, ImageChops; import json,sys; a=Image.open(sys.argv[1]).convert("RGB"); b=Image.open(sys.argv[2]).convert("RGB"); print(json.dumps({"same_size":a.size==b.size,"max_difference":max(v[1] for v in ImageChops.difference(a,b).getextrema()) if a.size==b.size else 255}))',
          path.join(out, `developer-${name}-baseline.png`), path.join(out, `developer-${name}.png`)], { encoding: 'utf8' }));
        assert.equal(difference.same_size, true);
        assert(difference.max_difference <= 1, `Developer ${name} retains its appearance`);
      }
      await old.close();
      checks.push('Developer header/input retain dimensions and appearance; at most 1/255 channel rasterisation difference');
    }

    const switchView = async name => {
      const count = analyses;
      await page.getByRole('radio', { name, exact: true }).check();
      assert.equal(analyses, count, 'Switching views must not analyse');
    };
    await switchView('Community Workshop');
    await page.getByRole('heading', { name: 'Synthetic Realities', exact: true }).waitFor();
    const communityBrand = await page.locator('.community-heading .sda-wordmark').evaluate(e => {
      const s = getComputedStyle(e); return { colour: s.color, font: s.fontFamily, weight: s.fontWeight, size: s.fontSize };
    });
    assert.deepEqual(developerBrand, communityBrand, 'Developer and community use the same wordmark styling');
    await page.locator('.community-preview img').evaluate(img => img.decode());
    const artworkUrl = await page.locator('.community-preview img').getAttribute('src');
    const artwork = await page.request.get(new URL(artworkUrl, base).href);
    assert.equal(artwork.ok(), true);
    assert.deepEqual(await artwork.body(), image, 'Served illustration must exactly match the installed source asset');
    await page.screenshot({ path: path.join(out, 'community-desktop.png'), fullPage: true });
    assert.equal(await page.locator('.community-preview img').evaluate(img => img.naturalWidth > 0), true);
    assert.equal(await page.getByRole('checkbox', { name: 'Not sure yet', exact: true }).isChecked(), false);
    checks.push('Developer default, community artwork, no preselected impression');

    await page.getByLabel('Workshop example', { exact: true }).selectOption('workshop-example.png');
    await page.getByRole('checkbox', { name: 'Not sure yet', exact: true }).check();
    assert.equal(await page.locator('.community-choices label.selected').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 241, 154)');
    assert.match(await page.locator('.workshop-choice-response').innerText(), /Your first impression: Not sure yet/);
    await page.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).check();
    assert.equal(await page.getByRole('checkbox', { name: 'Not sure yet', exact: true }).isChecked(), false);
    assert.match(await page.locator('.workshop-choice-response').innerText(), /Your first impression: Illustrated \/ hand-drawn/);
    await page.getByRole('button', { name: "Let's discuss", exact: true }).click();
    await page.getByRole('heading', { name: 'What suggests drawing or illustration to you?', exact: true }).waitFor();
    await page.getByRole('button', { name: '1 Notice', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Human-made', exact: true }).check();
    assert.match(await page.locator('.workshop-choice-response').innerText(), /Illustrated \/ hand-drawn; Human-made/);
    await page.getByRole('checkbox', { name: 'Not sure yet', exact: true }).check();
    assert.equal(await page.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: 'Human-made', exact: true }).isChecked(), false);
    await page.getByRole('checkbox', { name: 'Made with AI', exact: true }).check();
    assert.match(await page.locator('.workshop-choice-response').innerText(), /Your first impression: Made with AI/);
    assert.equal(await page.getByText('This example was made with AI.', { exact: true }).count(), 0);
    await page.getByLabel('What makes you think that? (optional)', { exact: true }).fill('My private first impression.');
    await page.screenshot({ path: path.join(out, 'notice-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: "Let's discuss", exact: true }).click();
    await page.getByRole('heading', { name: 'What led you towards AI-made?', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'What led you towards AI-made?', exact: true }).evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('checkbox', { name: 'Small visual details', exact: true }).evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Space');
    assert.equal(await page.getByRole('checkbox', { name: 'Small visual details', exact: true }).isChecked(), true);
    await page.getByRole('checkbox', { name: 'Light, shadows or textures', exact: true }).check();
    assert.match(await page.locator('.workshop-choice-response').innerText(), /2 cues/);
    await page.getByLabel('What did your conversation bring up? (optional)', { exact: true }).fill('Private discussion note.');
    await page.screenshot({ path: path.join(out, 'discuss-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: "Let's check together", exact: true }).click();
    const overview = page.getByRole('table', { name: 'SDA checks at a glance' });
    assert.match(await overview.innerText(), /Not checked/);
    assert.match(await page.locator('.workshop-choice-response').innerText(), /workshop source record has yet to be added/);
    assert.equal(await page.getByRole('group', { name: 'What would you like to check next?', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Review and run checks', exact: true }).click();
    assert.equal(await page.locator('.community-findings').evaluate(e => e === document.activeElement), true);
    assert.equal(analyses, 0);
    const run = page.getByRole('button', { name: "Run SDA's checks", exact: true });
    assert.equal(await run.isDisabled(), true);
    const consent = page.getByRole('checkbox', { name: /^I agree to send/ });
    await consent.check();
    await page.getByText('Caption or context', { exact: true }).click();
    await page.getByLabel('What was shared with this item?', { exact: true }).fill('Context changed after consent.');
    assert.equal(await consent.isChecked(), false);
    await consent.check();
    await run.click();
    await page.locator('.community-result-heading').waitFor();
    assert.equal(analyses, 1);
    const compact = page.locator('.community-compact-summary');
    assert.equal(await page.locator('.community-activity > .community-compact-summary').count(), 1);
    assert.equal(await compact.getByRole('meter').count(), 1);
    assert.match(await compact.innerText(), /1 of 3 visual model checks completed/);
    assert.match(await compact.innerText(), /Timed out/);
    assert.match(await compact.innerText(), /Disabled/);
    assert.doesNotMatch(await page.locator('.community-model-agreement').innerText(), /3 visual models.*agree/);
    assert.equal(await compact.getByRole('meter', { name: 'Claude summary synthetic rating' }).getAttribute('aria-valuenow'), '72');
    const checksTable = page.getByRole('table', { name: 'SDA checks and key evidence' });
    assert.equal(await checksTable.isVisible(), true, 'Provider evidence starts expanded');
    assert.match(await overview.innerText(), /Leans AI-made or altered/);
    assert.match(await overview.innerText(), /No creation record found/);
    await overview.getByText('Leans AI-made or altered', { exact: true }).click();
    assert.match(await overview.innerText(), /1 of 3 model checks completed/);
    assert.match(await overview.innerText(), /OpenAI Vision: Timed out/);
    await page.screenshot({ path: path.join(out, 'check-overview-desktop.png'), fullPage: true });
    assert.equal(await page.locator('.community-provider-details').evaluate(e => e.open), true);
    await checksTable.getByText('Repeated textures across separate areas.', { exact: true }).waitFor();
    assert.equal(await checksTable.getByText('Fixture visual observation.', { exact: true }).count(), 0);
    assert.equal(await checksTable.getByRole('meter').count(), 2);
    assert.equal(await checksTable.getByRole('meter', { name: 'Claude Vision synthetic rating' }).getAttribute('aria-valuenow'), '72');
    assert.equal(await checksTable.getByRole('meter', { name: 'Local forensic cues synthetic rating' }).getAttribute('aria-valuenow'), '0');
    assert.equal(await checksTable.getByRole('row').filter({ hasText: 'OpenAI Vision' }).getByRole('meter').count(), 0);
    assert.equal(await checksTable.getByRole('row').filter({ hasText: 'C2PA Content Credentials' }).getByRole('meter').count(), 0);
    await checksTable.getByText('More evidence (1)', { exact: true }).click();
    assert.equal(await checksTable.getByText('Final evidence item kept in the disclosure.', { exact: true }).isVisible(), true);
    await page.locator('.community-record > summary').click();
    const recordLayout = await page.locator('.community-record-grid > div').evaluateAll(cells => cells.map(e => {
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y };
    }));
    assert.equal(recordLayout.length, 8);
    assert.equal(new Set(recordLayout.map(r => r.x)).size, 2);
    assert.equal(new Set(recordLayout.map(r => r.y)).size, 4);
    await checksTable.screenshot({ path: path.join(out, 'community-evidence-table.png') });
    await page.locator('.community-record').screenshot({ path: path.join(out, 'source-record.png') });
    checks.push('Matching wordmarks, shared key evidence, accessible rating bars, no failed/credential scores, four paired source rows');
    await page.getByRole('radio', { name: 'Train the trainer / Researcher', exact: true }).check();
    await page.getByRole('heading', { name: 'Questions for the group', exact: true }).waitFor();
    assert.match(await page.locator('.community-facilitator ol').innerText(), /What did each check cover/);
    await page.getByRole('button', { name: '1 Notice', exact: true }).click();
    assert.equal(await page.getByLabel('What makes you think that? (optional)', { exact: true }).inputValue(), 'My private first impression.');
    assert.match(await page.locator('.community-facilitator ol').innerText(), /different details catch people's attention/);
    await page.getByRole('button', { name: '2 Discuss', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Small visual details', exact: true }).isChecked(), true);
    assert.equal(await page.getByLabel('What did your conversation bring up? (optional)', { exact: true }).inputValue(), 'Private discussion note.');
    await page.getByRole('button', { name: '3 Check', exact: true }).click();
    assert.equal(await page.getByRole('group', { name: 'What would you like to check next?', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Reflect together', exact: true }).click();
    await page.getByRole('group', { name: 'Your view now', exact: true }).getByRole('checkbox', { name: 'A mix of both', exact: true }).check();
    assert.match(await page.locator('.workshop-choice-response').innerText(), /moved from "Made with AI" to "A mix of both"/);
    await page.getByRole('checkbox', { name: 'Pause before sharing', exact: true }).check();
    await page.getByLabel('What will you take away? (optional)', { exact: true }).fill('Private reflection note.');
    await page.screenshot({ path: path.join(out, 'reflect-desktop.png'), fullPage: true });
    assert.equal(analyses, 1);
    await page.screenshot({ path: path.join(out, 'trainer-desktop.png'), fullPage: true });
    checks.push('Explicit consent, consent reset on context change, trainer shares report and reflection');
    checks.push('Distinct stage questions, contextual first-impression feedback, keyboard tickboxes, persistent cues and separate reflection');

    await switchView('Developer');
    assert.equal(await page.locator('.topbar').isVisible(), true);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'console');
    await page.locator('.so-paste textarea').first().fill('Researcher note retained across presentations.');
    await switchView('Community Workshop');
    const summaryButton = page.getByRole('button', { name: 'Download CSV', exact: true });
    assert.equal(await page.getByRole('checkbox', { name: 'Include my workshop responses in the summary', exact: true }).isChecked(), true);
    await page.getByRole('checkbox', { name: 'Include my workshop responses in the summary', exact: true }).uncheck();
    let text = await downloadText(page, summaryButton);
    assert.match(text, /workshop-1/);
    assert.match(text, /Researcher note retained across presentations/);
    assert.doesNotMatch(text, /My private first impression/);
    assert.match(text, /Timed out/);
    assert.match(text, /Disabled/);
    assert.match(text, /synthetic rating: 72\/100/);
    assert.match(text, /Key evidence: Final evidence item kept in the disclosure/);
    assert.doesNotMatch(text, /synthetic rating: 99\/100/);
    assert.doesNotMatch(text, /Private discussion note|Private reflection note|## Workshop responses/);
    await page.getByRole('checkbox', { name: 'Include my workshop responses in the summary', exact: true }).check();
    text = await downloadText(page, summaryButton);
    assert.match(text, /My private first impression/);
    assert.match(text, /separate from automated scoring/);
    assert.match(text, /Notice: Made with AI \(chosen before SDA findings were available in this view\)/);
    assert.match(text, /Discussion cues: Small visual details; Light, shadows or textures/);
    assert.doesNotMatch(text, /Questions to follow up:/);
    assert.match(text, /Later view: A mix of both/);
    assert.match(text, /Next actions: Pause before sharing/);
    assert.match(text, /Private reflection note/);
    await page.getByText('Full research downloads', { exact: true }).click();
    const json = await downloadText(page, page.locator('.community-downloads').getByRole('button', { name: 'JSON', exact: true }));
    assert.equal(JSON.parse(json).meta.report_id, 'workshop-1');
    assert.equal(JSON.parse(json).consensus.overall_rating, 72);
    assert.equal(JSON.parse(json).second_opinion_gemini, 'Researcher note retained across presentations.');
    assert.equal(Object.keys(JSON.parse(json)).some(k => k.includes('reflection')), false);
    assert.doesNotMatch(json, /My private first impression|Private discussion note|Private reflection note/);
    await downloadText(page, page.locator('.community-downloads').getByRole('button', { name: 'Markdown', exact: true }));
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.community-print').isVisible(), true);
    assert.equal(await page.locator('.community-workspace').isVisible(), false);
    await page.emulateMedia({ media: 'screen' });
    checks.push('Developer theme and research notes retained, summary opt-in, full exports, print surface');

    for (const [name, width, height] of [['tablet-portrait',768,1024], ['tablet-landscape',1024,768], ['tablet-wide',1180,820], ['phone',390,844], ['small-phone',320,740]]) {
      await page.setViewportSize({ width, height });
      for (const view of ['Community Workshop','Train the trainer / Researcher']) {
        await switchView(view);
        for (const stage of ['1 Notice', '2 Discuss', '3 Check', '4 Reflect']) {
          await page.getByRole('button', { name: stage, exact: true }).click();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}/${stage}: no overflow`);
          if (view === 'Community Workshop') await page.locator('.community-activity').screenshot({ path: path.join(out, `${name}-${stage.split(' ')[1].toLowerCase()}.png`) });
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: no page overflow`);
        if (!(await page.locator('.community-record').evaluate(e => e.open))) await page.locator('.community-record > summary').click();
        const recordColumns = await page.locator('.community-record-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
        assert.equal(recordColumns, width <= 520 ? 1 : 2, `${name}: source record columns`);
        const badButtons = await page.locator('.community-workspace button').evaluateAll(buttons => buttons.filter(b => {
          const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43;
        }).map(b => b.textContent));
        assert.deepEqual(badButtons, [], `${name}: touch controls`);
        await page.screenshot({ path: path.join(out, `${view.startsWith('Community')?'community':'trainer'}-${name}.png`), fullPage: true });
      }
    }
    checks.push('768/1024/1180 tablet layouts, 390/320 phone layouts, touch target heights');

    const touch = await browser.newPage({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    touch.on('pageerror', e => errors.push(e.message));
    await mock(touch, requests, errors);
    await touch.goto(base);
    await touch.locator('.presentation-switcher label').filter({ hasText: 'Community Workshop' }).tap();
    await touch.getByLabel('Workshop example', { exact: true }).selectOption('workshop-example.png');
    await touch.getByRole('button', { name: 'Enlarge image', exact: true }).waitFor();
    await touch.getByRole('button', { name: 'Enlarge image', exact: true }).tap();
    await touch.getByRole('dialog').waitFor();
    await touch.getByRole('button', { name: 'Close enlarged image', exact: true }).tap();
    await touch.getByRole('checkbox', { name: 'Made with AI', exact: true }).tap();
    await touch.getByRole('button', { name: "Let's discuss", exact: true }).tap();
    await touch.getByRole('checkbox', { name: 'Small visual details', exact: true }).tap();
    assert.equal(await touch.getByRole('checkbox', { name: 'Small visual details', exact: true }).isChecked(), true);
    await touch.getByRole('button', { name: '3 Check', exact: true }).tap();
    assert.equal(await touch.getByRole('button', { name: "Run SDA's checks", exact: true }).isDisabled(), true);
    assert.equal(analyses, 1);
    await touch.getByRole('button', { name: '4 Reflect', exact: true }).tap();
    await touch.getByRole('checkbox', { name: 'Not sure yet', exact: true }).tap();
    await touch.getByRole('button', { name: 'New session', exact: true }).tap();
    await touch.getByRole('dialog').getByRole('checkbox', { name: 'I am ready to clear this page and start a new session' }).check();
    await touch.getByRole('button', { name: 'Start new session', exact: true }).tap();
    await touch.getByLabel('Workshop example', { exact: true }).selectOption('second-example.png');
    await touch.waitForFunction(() => document.querySelector('select[aria-label="Workshop example"]')?.value === 'second-example.png');
    assert.equal(await touch.getByLabel('Workshop example', { exact: true }).inputValue(), 'second-example.png');
    assert.equal(await touch.getByRole('checkbox', { name: 'Made with AI', exact: true }).isChecked(), false);
    await touch.getByRole('button', { name: '2 Discuss', exact: true }).tap();
    assert.equal(await touch.getByRole('checkbox', { name: 'Small visual details', exact: true }).isChecked(), false);
    assert.equal(analyses, 1);
    await touch.close();
    checks.push('Touch-enabled tablet: view switching, enlarge/close and step controls');
    checks.push('Touch tickboxes and next-example reset without analysis');

    const video = execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=teal:s=160x120:r=1','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1']);
    const wav = Buffer.alloc(16044); wav.write('RIFF'); wav.writeUInt32LE(16036,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(16000,40);
    await page.setViewportSize({ width: 1024, height: 768 });
    await switchView('Community Workshop');
    for (const [nextKind, name, mime, buffer] of [
      ['video','fixture.mp4','video/mp4',video], ['audio','fixture.wav','audio/wav',wav],
      ['pdf','fixture.pdf','application/pdf',Buffer.from('PDF UI fixture')],
      ['pptx','fixture.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',Buffer.from('PPTX UI fixture')],
      ['text','fixture.txt','text/plain',Buffer.from('A transcript fixture.')],
    ]) {
      kind = nextKind; filename = name;
      await page.getByLabel('Choose a workshop file', { exact: true }).setInputFiles({ name, mimeType: mime, buffer });
      assert.equal(await page.getByLabel('What makes you think that? (optional)', { exact: true }).inputValue(), '');
      await page.getByRole('button', { name: '3 Check', exact: true }).click();
      assert.equal(await page.getByRole('checkbox', { name: /^I agree to send/ }).isChecked(), false);
      await page.getByRole('checkbox', { name: /^I agree to send/ }).check();
      await page.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
      await page.locator('.community-result-heading').waitFor();
      assert.equal(await page.locator('.workshop-image-search').count(), ['video','pdf','pptx'].includes(kind) ? 1 : 0);
      if (['video','pdf','pptx'].includes(kind)) {
        await page.locator('.community-source-evidence > summary').click();
        await page.locator('.workshop-image-search summary').click();
        assert.match(await page.locator('.workshop-image-search').innerText(), /still frame or page image/);
        await page.locator('.workshop-image-search summary').click();
        assert.equal(await page.locator('.community-frame-tools .cw-button').count(), 1);
      }
      assert.equal(await page.getByRole('button', { name: 'OpenAI images check', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Gemini SynthID check', exact: true }).isDisabled(), kind === 'text');
      assert.equal(await page.locator('.community-compact-summary').getByRole('meter').count(), 1);
      assert.match(await page.locator('.community-model-agreement').innerText(), ['audio','text'].includes(kind) ? /text model/ : /visual model/);
      assert.equal(await page.locator('.community-provider-details').evaluate(e => e.open), true);
      if (kind === 'video') {
        const credentials = page.locator('.community-provider-details .community-history');
        await credentials.locator('summary').click();
        assert.match(await credentials.innerText(), /passed their technical checks/);
        assert.match(await credentials.innerText(), /yet to establish trust in whoever signed the record/);
        assert.equal(await credentials.getByRole('meter').count(), 0);
      }
      if (['video','audio'].includes(kind)) {
        assert.match(await page.getByRole('table', { name: 'SDA checks at a glance' }).innerText(), /Audio track found/);
        await page.locator('.community-tabs').getByRole('tab', { name: 'Sound', exact: true }).click();
        await page.locator('.community-provider-details .soundtrack-section').waitFor();
        assert.match(await page.locator('.community-provider-details .soundtrack-section').innerText(), /Not checked/);
        await page.locator('.community-tabs').getByRole('tab', { name: 'Sound', exact: true }).press('ArrowRight');
        assert.equal(await page.locator('.community-tabs [aria-selected="true"]').innerText(), kind === 'audio' ? 'Transcript' : 'Picture');
        text = await downloadText(page, page.getByRole('button', { name: 'Download CSV', exact: true }));
        assert.match(text, /AI-origin detection from the sound itself is outside/);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(out, `community-${kind}-tablet.png`), fullPage: true });
    }
    checks.push('Video, silent audio, PDF/PPTX and transcript UI paths; soundtrack tabs and keyboard navigation');
    fail = true;
    await page.getByLabel('Choose a workshop file', { exact: true }).setInputFiles({ name: 'error.txt', mimeType: 'text/plain', buffer: Buffer.from('Error fixture') });
    await page.getByRole('button', { name: '3 Check', exact: true }).click();
    await page.getByRole('checkbox', { name: /^I agree to send/ }).check();
    await page.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
    await page.locator('.community-status').getByText('Fixture service unavailable.', { exact: true }).waitFor();
    assert.equal(await page.locator('.community-result-heading').count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: /^I agree to send/ }).isChecked(), false);
    checks.push('Failed analysis remains a failure, with consent reset');
    fail = false; kind = 'image'; filename = 'workshop-example.png';
    const agreedPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await agreedPage.addInitScript(() => {
      window.__opened = []; window.__copied = []; window.__copyEvents = [];
      window.__copyMode = 'success'; window.__asyncClipboardCalls = 0; window.__nativeCopyEvents = [];
      const nativeCopy = document.execCommand.bind(document);
      document.addEventListener('copy', () => {
        const field = document.activeElement;
        window.__nativeCopyEvents.push(field instanceof HTMLTextAreaElement ? field.value.substring(field.selectionStart, field.selectionEnd) : '');
      });
      window.open = (...args) => { window.__copyEvents.push('open'); window.__opened.push(args); return null; };
      document.execCommand = command => {
        if (command !== 'copy') throw new Error('Unexpected command: ' + command);
        window.__copyEvents.push('copy');
        if (window.__copyMode === 'throw') throw new Error('Fixture copy unavailable');
        if (window.__copyMode === 'blocked') return false;
        if (window.__copyMode === 'native') return nativeCopy('copy');
        const field = document.activeElement;
        window.__copied.push(field.value.substring(field.selectionStart, field.selectionEnd));
        return true;
      };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {
        window.__asyncClipboardCalls++; throw new Error('Unexpected permission-based clipboard call');
      } } });
    });
    const googleRequests = [];
    await agreedPage.context().route('https://images.google.com/**', async route => {
      googleRequests.push({ url: route.request().url(), method: route.request().method(), body: route.request().postData(), headers: route.request().headers() });
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Mock image search</title><p>Mock image search landing page</p>' });
    });
    agreedPage.on('pageerror', e => errors.push(e.message));
    await mock(agreedPage, requests, errors, value => {
      value.providers.forEach((p, i) => {
        if (p.kind === 'vision') Object.assign(p, { status: 'ok', verdict: 'synthetic_likely', rating: [90,82,72][i], confidence: 'medium' });
        if (p.id === 'c2pa') Object.assign(p, { summary: 'File integrity: validated. Signer trust: unresolved. Manifest declares AI-generated content.',
          raw: { validation: { integrity: 'valid', trust: 'untrusted' }, declaration: 'Manifest declares AI-generated content.', declared_verdict: 'synthetic_likely', active_manifest: 'fixture',
            history: [{ scope: 'active', manifest: 'fixture', declared_signer: 'Fixture signing service' }] } });
      });
      return value;
    });
    await agreedPage.goto(base);
    await agreedPage.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
    await agreedPage.getByLabel('Workshop example', { exact: true }).selectOption('workshop-example.png');
    await agreedPage.getByRole('button', { name: '3 Check', exact: true }).click();
    await agreedPage.getByRole('checkbox', { name: /^I agree to send/ }).check();
    await agreedPage.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
    await agreedPage.locator('.community-result-heading').waitFor();
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), true);
    assert.equal(await agreedPage.locator('.community-context').evaluate(e => e.open), false);
    assert.equal(await agreedPage.getByRole('heading', { name: 'What the checks suggest', exact: true }).count(), 1);
    assert.match(await agreedPage.locator('.community-model-agreement').innerText(), /3 visual models \(Claude, OpenAI and Google Gemini\) agree this is likely synthetic\. Compare these readings with the source and context\./);
    assert.deepEqual(await agreedPage.locator('.community-mini-models [role="meter"]').evaluateAll(elements => elements.map(e => e.getAttribute('aria-valuenow'))), ['90','82','72']);
    assert.equal(await agreedPage.getByRole('table', { name: 'SDA checks at a glance' }).getByText('Image history', { exact: true }).count(), 0);
    const history = agreedPage.locator('.community-history');
    assert.equal(await history.evaluate(e => e.open), false);
    await history.locator('summary').click();
    assert.equal((await history.innerText()).split('The record declares AI-generated content.').length - 1, 1);
    assert.match(await history.innerText(), /yet to establish trust/);
    assert.match(await history.innerText(), /signer as Fixture signing service/);
    assert.match(await history.innerText(), /creator and first sharer still need checking/);
    for (const question of ['Creator or first sharer', 'Date and place', 'Recorded creation method']) {
      assert.equal(await history.getByText(question, { exact: true }).isVisible(), true);
    }
    assert.equal(await agreedPage.locator('.community-compact-summary details').count(), 0);
    assert.equal(await agreedPage.getByText('Recorded assessment explanation', { exact: true }).count(), 0);
    assert.equal(await agreedPage.locator('.community-source-evidence').evaluate(e => e.open), false);
    assert.equal(await agreedPage.locator('.community-second-opinions').evaluate(e => e.open), true);
    assert.equal(await agreedPage.locator('.community-evidence-box .community-opinion-tools').count(), 1);
    const evidencePosition = await agreedPage.evaluate(() => ({ summary: document.querySelector('.community-compact-summary').getBoundingClientRect().bottom,
      box: document.querySelector('.community-evidence-box').getBoundingClientRect().top }));
    assert(evidencePosition.box >= evidencePosition.summary);
    const originalDownload = agreedPage.waitForEvent('download');
    await agreedPage.getByRole('link', { name: 'Download original file', exact: true }).click();
    assert.equal(fs.readFileSync(await (await originalDownload).path()).equals(image), true, 'Original download preserves the complete input bytes');
    const buttonContrasts = await agreedPage.locator('.community-opinion-actions button').evaluateAll(buttons => {
      const luminance = colour => {
        const rgb = colour.match(/[\d.]+/g).slice(0,3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      return buttons.map(button => { const style = getComputedStyle(button), pair = [luminance(style.color), luminance(style.backgroundColor)].sort((a,b) => b-a); return (pair[0] + .05) / (pair[1] + .05); });
    });
    assert(buttonContrasts.every(contrast => contrast >= 4.5));
    assert.match(await agreedPage.locator('.workshop-overview th').allTextContents().then(values => values.join(' ')), /Is it authentic\?.*Who made it\?.*What evidence supports its claim\?/);
    await agreedPage.locator('.community-source-evidence > summary').click();
    assert.equal(await agreedPage.locator('.community-source-evidence > summary').evaluate(e => e === document.activeElement), true);
    const sourceSearch = agreedPage.locator('.workshop-image-search');
    const lensLink = sourceSearch.getByRole('link', { name: /^Google Lens \/ image search/ });
    assert.equal(await lensLink.getAttribute('href'), 'https://images.google.com/');
    assert.equal(await lensLink.getAttribute('target'), '_blank');
    assert.equal(await lensLink.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await lensLink.getAttribute('referrerpolicy'), 'no-referrer');
    assert.match(await sourceSearch.innerText(), /SDA opens only the search page/);
    assert.deepEqual(googleRequests, [], 'Viewing SDA makes no image-search request');
    const beforeSearch = analyses;
    const searchOpened = agreedPage.context().waitForEvent('page');
    await lensLink.focus();
    await agreedPage.keyboard.press('Enter');
    const searchPage = await searchOpened;
    await searchPage.waitForLoadState();
    assert.equal(await searchPage.evaluate(() => window.opener === null), true);
    assert.equal(googleRequests.length, 1);
    assert.equal(googleRequests[0].url, 'https://images.google.com/');
    assert.equal(googleRequests[0].method, 'GET');
    assert.equal(googleRequests[0].body, null);
    assert.equal(googleRequests[0].headers.referer, undefined);
    assert.equal(analyses, beforeSearch, 'Source search is separate from model analysis');
    await searchPage.close();
    await sourceSearch.locator('summary').click();
    assert.match(await sourceSearch.innerText(), /earliest search result may be a repost/);
    assert.match(await sourceSearch.innerText(), /can differ from when it was created/);
    await sourceSearch.screenshot({ path: path.join(out, 'source-search-guidance.png') });
    await sourceSearch.locator('summary').click();
    await agreedPage.getByLabel('Links, dates and what you found (optional)', { exact: true }).fill('PRIVATE SOURCE LEAD: https://example.org/archive; date needs checking.');
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), true, 'Provider evidence stays open while editing source notes');
    await agreedPage.locator('.community-provider-details > summary').click();
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), false, 'A user can still collapse provider evidence');
    assert.equal(scoreRequests.length, 0);
    const beforeOpinions = analyses;
    const checkingPrompt = agreedPage.getByRole('textbox', { name: 'Gemini checking prompt', exact: true });
    assert.equal(await checkingPrompt.isVisible(), true);
    assert.equal(await checkingPrompt.getAttribute('readonly'), '');
    const expectedPrompt = await checkingPrompt.inputValue();
    await agreedPage.getByRole('button', { name: 'Gemini SynthID check', exact: true }).click();
    await agreedPage.waitForFunction(() => window.__copied.length === 1);
    assert.deepEqual(await agreedPage.evaluate(() => window.__copyEvents), ['copy', 'open']);
    assert.equal(await agreedPage.evaluate(() => window.__copied[0]), expectedPrompt);
    await agreedPage.getByRole('button', { name: 'OpenAI images check', exact: true }).click();
    assert.deepEqual(await agreedPage.evaluate(() => window.__opened), [
      ['https://gemini.google.com/app', '_blank', 'noopener,noreferrer'], ['https://openai.com/research/verify/', '_blank', 'noopener,noreferrer']]);
    assert.match(await agreedPage.evaluate(() => window.__copied[0]), /workshop-example.png/);
    assert.equal(analyses, beforeOpinions);
    const copyButton = agreedPage.getByRole('button', { name: 'Copy prompt', exact: true });
    await copyButton.focus();
    await agreedPage.keyboard.press('Enter');
    assert.equal(await agreedPage.evaluate(() => window.__copied.at(-1)), expectedPrompt);
    assert.equal(await copyButton.evaluate(e => document.activeElement === e), true, 'Copying restores button focus');
    assert.equal(await agreedPage.evaluate(() => window.__opened.length), 2, 'Copy-only does not open another tab');
    for (const mode of ['blocked', 'throw']) {
      await agreedPage.evaluate(value => { window.__copyMode = value; }, mode);
      await agreedPage.getByRole('button', { name: 'Gemini SynthID check', exact: true }).click();
      assert.match(await agreedPage.locator('.community-opinion-tools [role="status"]').innerText(), /Automatic copying was unavailable/);
      assert.equal(await checkingPrompt.isVisible(), true);
      assert.equal(await checkingPrompt.inputValue(), expectedPrompt);
      await copyButton.click();
      assert.match(await agreedPage.locator('.community-opinion-tools [role="status"]').innerText(), /shown below for you to copy/);
      await checkingPrompt.focus();
      assert.equal(await checkingPrompt.evaluate(e => e.value.substring(e.selectionStart, e.selectionEnd)), expectedPrompt);
      assert.equal(await agreedPage.locator('body > textarea').count(), 0, 'Temporary copy fields are removed on every outcome');
    }
    await agreedPage.evaluate(() => { window.__copyMode = 'native'; });
    await copyButton.click();
    assert.match(await agreedPage.locator('.community-opinion-tools [role="status"]').innerText(), /Prompt copied to your clipboard/);
    assert.deepEqual(await agreedPage.evaluate(() => window.__nativeCopyEvents), [expectedPrompt]);
    assert.equal(await agreedPage.evaluate(() => window.__asyncClipboardCalls), 0, 'No async clipboard permission flow, including on failure');
    await agreedPage.evaluate(() => { window.__copyMode = 'success'; });
    const gemReply = agreedPage.locator('.community-opinion-reply').filter({ has: agreedPage.locator('summary', { hasText: /^Gemini reply/ }) });
    const openReply = agreedPage.locator('.community-opinion-reply').filter({ has: agreedPage.locator('summary', { hasText: /^OpenAI reply/ }) });
    await gemReply.locator(':scope > summary').click();
    await openReply.locator(':scope > summary').click();
    await gemReply.getByLabel('Gemini reply (paste result)', { exact: true }).fill('Fixture Gemini reply: watermark check unavailable; visual opinion only.');
    await openReply.getByLabel('OpenAI reply (paste result)', { exact: true }).fill('Fixture OpenAI reply: no supported signal found.');
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), false, 'Reply edits respect a deliberate collapse');
    await gemReply.getByRole('combobox', { name: 'How this reply was obtained' }).selectOption('yes');
    assert.equal(scoreRequests.length, 0, 'Pasting replies is local until an explicit note-scoring action');
    await gemReply.locator('.community-note-score > summary').click();
    assert.match(await gemReply.innerText(), /4,000 characters to Anthropic.*API key/);
    await gemReply.getByRole('button', { name: 'Add note to scoring', exact: true }).click();
    await gemReply.getByText(/Fixture note assessment/).waitFor();
    assert.deepEqual(scoreRequests, [{ text: 'Fixture Gemini reply: watermark check unavailable; visual opinion only.', consent_to_anthropic: true }]);
    assert.deepEqual(await agreedPage.locator('.community-mini-models [role="meter"]').evaluateAll(elements => elements.map(e => e.getAttribute('aria-valuenow'))), ['90','82','72']);
    await agreedPage.locator('.shared-graph > summary').click();
    await agreedPage.getByRole('button', { name: 'Build graph', exact: true }).click();
    await agreedPage.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent === 'Build graph' && !e.disabled));
    assert.equal(graphRequests.at(-1).reports[0].second_opinion_gemini_score, 66);
    assert.match(graphRequests.at(-1).reports[0].second_opinion_chatgpt, /no supported signal/);
    assert.doesNotMatch(JSON.stringify(graphRequests.at(-1)), /PRIVATE SOURCE LEAD/);
    await agreedPage.locator('.shared-graph > summary').click();
    await agreedPage.getByRole('radio', { name: 'Developer', exact: true }).check();
    assert.equal(await checkingPrompt.isVisible(), true);
    assert.equal(await checkingPrompt.inputValue(), expectedPrompt);
    await agreedPage.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    assert.equal(await agreedPage.evaluate(() => window.__copied.at(-1)), expectedPrompt);
    await agreedPage.evaluate(() => { window.__copyMode = 'blocked'; });
    await agreedPage.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    assert.match(await agreedPage.locator('.second-opinion .toast').innerText(), /Automatic copying was unavailable/);
    assert.equal(await checkingPrompt.isVisible(), true);
    await agreedPage.evaluate(() => { window.__copyMode = 'success'; });
    assert.match(await agreedPage.locator('.so-paste textarea').first().inputValue(), /watermark check unavailable/);
    await agreedPage.locator('.so-paste textarea').first().fill('Revised Gemini reply from Developer.');
    await agreedPage.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
    await gemReply.locator(':scope > summary').click();
    assert.equal(await gemReply.getByLabel('Gemini reply (paste result)', { exact: true }).inputValue(), 'Revised Gemini reply from Developer.');
    assert.equal(await agreedPage.getByLabel('Links, dates and what you found (optional)', { exact: true }).inputValue(), 'PRIVATE SOURCE LEAD: https://example.org/archive; date needs checking.');
    await gemReply.locator(':scope > summary').click();
    await agreedPage.locator('.community-source-evidence > summary').click();
    const beforeEvidence = analyses;
    const evidenceLink = agreedPage.getByRole('button', { name: 'View the supporting details below', exact: true });
    await evidenceLink.focus();
    await agreedPage.keyboard.press('Enter');
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), true);
    assert.equal(await agreedPage.locator('.community-provider-details > summary').evaluate(e => e === document.activeElement), true);
    assert.equal(analyses, beforeEvidence, 'Opening supporting details does not trigger analysis');
    await agreedPage.getByRole('checkbox', { name: 'Include my workshop responses in the summary', exact: true }).uncheck();
    const exportText = await downloadText(agreedPage, agreedPage.getByRole('button', { name: 'Download CSV', exact: true }));
    assert.match(exportText, /The record declares AI-generated content/);
    assert.match(exportText, /Recorded explanation: Fixture readings suggest synthetic content/);
    assert.match(exportText, /Revised Gemini reply from Developer/);
    assert.doesNotMatch(exportText, /PRIVATE SOURCE LEAD/);
    await agreedPage.locator('.community-evidence-box').screenshot({ path: path.join(out, 'evidence-box-desktop.png') });
    await agreedPage.locator('.community-discussion').screenshot({ path: path.join(out, 'plain-history-questions.png') });
    await agreedPage.locator('.community-compact-summary').screenshot({ path: path.join(out, 'compact-agreement-summary.png') });
    for (const [width, height] of [[1440,1100],[1024,768],[768,1024],[390,844],[320,740]]) {
      await agreedPage.setViewportSize({ width, height });
      const layout = await agreedPage.evaluate(() => {
        const rect = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { x:b.x, y:b.y, width:b.width, bottom:b.bottom }; };
        return { context:rect('.community-context'), summary:rect('.community-compact-summary'), media:rect('.community-media'), activity:rect('.community-activity'), details:rect('.community-provider-details'), overflow:document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.equal(layout.overflow, false);
      assert(Math.abs(layout.summary.x - layout.media.x) < 1);
      assert(layout.summary.y >= layout.context.bottom, 'Findings follow the activity');
      assert(Math.abs(layout.summary.width - layout.activity.width) < 1, 'Findings span the activity width');
      assert(layout.details.y >= layout.activity.bottom, 'Provider evidence stays underneath the whole activity');
      assert(Math.abs(layout.details.width - layout.summary.width) < 1, 'Provider evidence and findings both span the page');
      await agreedPage.screenshot({ path: path.join(out, `compact-layout-${width}.png`), fullPage: true });
    }
    await agreedPage.getByRole('radio', { name: 'Train the trainer / Researcher', exact: true }).check();
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), true, 'Expanded evidence is retained in Facilitator');
    assert.equal(await checkingPrompt.isVisible(), true);
    await agreedPage.getByRole('button', { name: 'Copy prompt', exact: true }).click();
    assert.equal(await agreedPage.evaluate(() => window.__copied.at(-1)), expectedPrompt);
    assert.equal(await agreedPage.evaluate(() => window.__asyncClipboardCalls), 0);
    assert.equal(await agreedPage.locator('.community-activity > .community-compact-summary').count(), 1);
    assert.equal(await agreedPage.locator('.community-source-evidence').count(), 1);
    await agreedPage.getByRole('button', { name: '1 Notice', exact: true }).click();
    await agreedPage.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).check();
    await agreedPage.getByRole('checkbox', { name: 'Made with AI', exact: true }).focus();
    await agreedPage.keyboard.press('Space');
    assert.equal(await agreedPage.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).isChecked(), true);
    assert.equal(await agreedPage.getByRole('checkbox', { name: 'Made with AI', exact: true }).isChecked(), true);
    await agreedPage.getByRole('button', { name: '2 Discuss', exact: true }).click();
    await agreedPage.getByRole('heading', { name: 'How do your choices fit together?', exact: true }).waitFor();
    await agreedPage.getByRole('button', { name: '4 Reflect', exact: true }).click();
    await agreedPage.getByRole('checkbox', { name: 'Made with AI', exact: true }).check();
    await agreedPage.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).check();
    assert.match(await agreedPage.locator('.workshop-choice-response').innerText(), /kept your first impression/);
    await agreedPage.getByRole('checkbox', { name: 'Not sure yet', exact: true }).check();
    await agreedPage.getByRole('checkbox', { name: 'Human-made', exact: true }).check();
    await agreedPage.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).check();
    assert.match(await agreedPage.locator('.workshop-choice-response').innerText(), /moved from "Illustrated \/ hand-drawn; Made with AI" to "Human-made; Illustrated \/ hand-drawn"/);
    await agreedPage.getByRole('checkbox', { name: 'Include my workshop responses in the summary', exact: true }).check();
    const balancedExport = await downloadText(agreedPage, agreedPage.getByRole('button', { name: 'Download CSV', exact: true }));
    assert.match(balancedExport, /Notice: Illustrated \/ hand-drawn; Made with AI \(chosen after SDA findings were available/);
    assert.match(balancedExport, /Later view: Human-made; Illustrated \/ hand-drawn/);
    assert.match(balancedExport, /Recorded conclusion: synthetic likely/);
    assert.match(balancedExport, /Image-search evidence \(participant note\): PRIVATE SOURCE LEAD/);
    assert.match(balancedExport, /Revised Gemini reply from Developer/);
    assert.match(await agreedPage.locator('.community-model-agreement').innerText(), /agree this is likely synthetic/);
    await agreedPage.getByRole('radio', { name: 'Developer', exact: true }).check();
    await agreedPage.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
    assert.equal(await agreedPage.getByRole('checkbox', { name: 'Human-made', exact: true }).isChecked(), true);
    assert.equal(await agreedPage.getByRole('checkbox', { name: 'Illustrated / hand-drawn', exact: true }).isChecked(), true);
    await agreedPage.locator('.community-discussion').screenshot({ path: path.join(out, 'balanced-origin-choices.png') });
    await agreedPage.getByRole('button', { name: 'New session', exact: true }).click();
    assert.equal(await agreedPage.getByRole('button', { name: 'Start new session', exact: true }).isDisabled(), true);
    await agreedPage.getByRole('button', { name: 'Keep working', exact: true }).click();
    assert.equal(await agreedPage.getByRole('checkbox', { name: 'Human-made', exact: true }).isChecked(), true);
    await agreedPage.getByRole('button', { name: 'New session', exact: true }).click();
    await agreedPage.getByRole('dialog').getByRole('checkbox', { name: 'I am ready to clear this page and start a new session' }).check();
    await agreedPage.getByRole('button', { name: 'Start new session', exact: true }).click();
    await agreedPage.getByLabel('Workshop example', { exact: true }).selectOption('second-example.png');
    await agreedPage.waitForFunction(() => document.querySelector('select[aria-label="Workshop example"]')?.value === 'second-example.png');
    assert.equal(await agreedPage.locator('.community-evidence-box').count(), 0);
    assert.equal(await agreedPage.getByRole('group', { name: 'First impression', exact: true }).locator('input:checked').count(), 0);
    await agreedPage.getByRole('button', { name: '3 Check', exact: true }).click();
    await agreedPage.getByRole('checkbox', { name: /^I agree to send/ }).check();
    await agreedPage.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
    await agreedPage.locator('.community-evidence-box').waitFor();
    assert.equal(await agreedPage.locator('.community-provider-details').evaluate(e => e.open), true, 'New results show provider evidence automatically');
    await agreedPage.locator('.community-source-evidence > summary').click();
    assert.equal(await agreedPage.getByLabel('Links, dates and what you found (optional)', { exact: true }).inputValue(), '');
    await agreedPage.locator('.community-opinion-reply > summary').first().click();
    assert.equal(await agreedPage.getByLabel('Gemini reply (paste result)', { exact: true }).inputValue(), '');
    await agreedPage.close();
    checks.push('Compact findings directly under media/context; named three-model ratings; wide provider evidence; single credential declaration; visual/text scope retained');
    checks.push('Manual Google image-search link: keyboard new-tab opening, no uploaded bytes/query/referrer, no background requests or analysis, visual-media scope, source-search limitations');
    checks.push('Illustrated/hand-drawn and human-made impressions: Notice/Discuss/Reflect, Trainer/Developer view preservation, opt-in export, independent automated verdict');
    checks.push('Multiple origin tickboxes: keyboard selection, exclusive uncertainty, order-independent reflection, all selections in opted-in export, cleared for next example');
    checks.push('Evidence box: source notes opt-in only, shared second-opinion edits, explicit isolated note scoring, graph/export propagation, media-aware external buttons');
    checks.push('Gemini prompt: visible/selectable in all modes, click-copy before opening, copy-only button, failure/exception fallback, native Chromium copy event, no async clipboard request');
    checks.push('Provider evidence opens with results, stays open during Evidence-box editing and mode changes, and respects a deliberate collapse');
    assert.deepEqual(errors, []);
    assert.equal(requests.some(r => ['/api/audio/assess','/api/suno/check'].includes(r)), false);
    assert.equal(scoreRequests.length, 1);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ ok: true, checks, mockedAnalyses: analyses, realProviderCalls: 0, errors }, null, 2));
    console.log(JSON.stringify({ ok: true, checks, mockedAnalyses: analyses, realProviderCalls: 0, screenshots: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
