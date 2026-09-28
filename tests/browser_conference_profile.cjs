// Conference UI acceptance: static frontend, intercepted API, no inference.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { report } = require('./browser_community_views.cjs');
const base = process.env.CONFERENCE_URL || 'http://127.0.0.1:8770';
const out = path.resolve(process.env.CONFERENCE_OUTPUT || '.review-cache/demo-implementation-2026-09-26/conference-browser');
const image = fs.readFileSync(path.resolve('frontend/src/assets/community-illustration.png'));
const ready = { configured: true, state: 'ready', model: 'fixture' };
const names = ['approved-one.png', 'approved-two.png'];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const requests = [], analyses = [], forbidden = [], errors = [];
  let fail = false, mismatch = false;
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
    if (url.origin !== new URL(base).origin) { forbidden.push(req.url()); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    requests.push({ method: req.method(), path: url.pathname });
    let body;
    if (url.pathname === '/api/providers') body = { delivery_profile: mismatch ? 'research' : 'conference',
      tool: 'SDA Vision', version: 'test', dev_mode: false, vaccine_lens: true, corpus_available: false,
      claude: ready, openai: ready, gemini: ready, local: ready, c2pa: ready, synthid: ready };
    else if (url.pathname === '/api/corpus') body = { available: false, labels: [] };
    else if (url.pathname === '/api/examples') body = { files: names.map(name => ({ name })) };
    else if (url.pathname === '/api/examples/file') {
      assert.ok(names.includes(url.searchParams.get('name')));
      return route.fulfill({ contentType: 'image/png', body: image });
    } else if (url.pathname === '/api/examples/thumb') body = { thumbnail: null };
    else if (url.pathname === '/api/conference/analyse') {
      assert.equal(req.headers()['content-type'], 'application/json');
      const payload = req.postDataJSON();
      assert.deepEqual(Object.keys(payload).sort(), ['consent_to_providers', 'example_id', 'mode']);
      assert.ok(names.includes(payload.example_id));
      assert.equal(payload.consent_to_providers, true);
      analyses.push(payload);
      if (fail) return route.fulfill({ status: 504, contentType: 'application/json',
        body: JSON.stringify({ detail: 'Conference analysis timed out. Open the saved-results fallback.' }) });
      body = report(); body.meta.filename = payload.example_id;
    } else if (url.pathname === '/api/diffusion') body = { source: 'item', nodes: [], edges: [], stats: { nodes: 0, edges: 0, clusters: 0, largest_cluster: 0 } };
    else if (url.pathname === '/api/diffusion/summary') body = { headline: 'Fixture relationship map', caption: 'Fixture only', paragraph: 'Fixture only' };
    else { forbidden.push(url.pathname); return route.abort(); }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(base);
    await page.getByText('Conference — live analysis', { exact: true }).waitFor();
    await page.locator('.example-btn').first().waitFor();
    for (const view of ['Developer', 'Community Workshop', 'Train the trainer / Researcher']) {
      await page.getByRole('radio', { name: view, exact: true }).check();
      assert.equal(await page.locator('input[type=file]').count(), 0);
    }
    await page.getByRole('radio', { name: 'Developer', exact: true }).check();
    const consent = page.getByRole('checkbox', { name: /^I agree to send the selected example/ });
    await page.locator('.example-btn').first().click();
    await page.getByRole('button', { name: 'Run live analysis', exact: true }).click();
    assert.equal(analyses.length, 0, 'Consent must gate the provider request');
    await consent.check();
    await page.locator('.example-btn').nth(1).click();
    assert.equal(await consent.isChecked(), false, 'A new original resets consent');
    await consent.check();
    await page.getByRole('button', { name: 'Run live analysis', exact: true }).click();
    await page.locator('.so-paste textarea').first().waitFor();
    assert.equal(analyses.length, 1);
    assert.equal(await consent.isChecked(), false, 'Starting a run consumes the consent');
    assert.equal(await page.getByRole('button', { name: 'Add note to scoring', exact: true }).count(), 0);
    await page.locator('.so-paste textarea').first().fill('Presenter note, separate from the recorded assessment.');
    assert.equal(analyses.length, 1);
    for (const name of names) {
      await page.getByRole('combobox', { name: 'Batch example', exact: true }).selectOption(name);
      await page.getByRole('button', { name: /^Add example/ }).click();
      await page.waitForFunction(() => !document.querySelector('[aria-label="Batch example"]').disabled);
    }
    await page.getByRole('button', { name: 'Select up to 5', exact: true }).click();
    await consent.check();
    await page.getByRole('checkbox', { name: 'Select approved-one.png', exact: true }).uncheck();
    assert.equal(await consent.isChecked(), false, 'Changing the selected batch resets consent');
    await page.getByRole('checkbox', { name: 'Select approved-one.png', exact: true }).check();
    await consent.check();
    await page.getByRole('button', { name: 'Run batch (2)', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.qrow.run').length === 2);
    assert.equal(analyses.length, 3);
    await page.screenshot({ path: path.join(out, 'conference-batch.png'), fullPage: true });
    await page.locator('.example-btn').first().click();
    fail = true;
    await consent.check();
    await page.getByRole('button', { name: 'Run live analysis', exact: true }).click();
    await page.getByText('Conference analysis timed out. Open the saved-results fallback.', { exact: true }).waitFor();
    assert.equal(await consent.isChecked(), false);
    assert.equal(await page.locator('.so-paste textarea').count(), 0, 'A failed new selection must not display earlier findings');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(out, 'conference-mobile.png'), fullPage: true });
    mismatch = true; await page.reload();
    await page.getByRole('alert').filter({ hasText: 'delivery profiles differ' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Run live analysis', exact: true }).isDisabled(), true);
    assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'network.json'), JSON.stringify({ requests, analyses, forbidden, errors }, null, 2));
    console.log(JSON.stringify({ ok: true, mockedAnalyses: analyses.length, visitorUploadRequests: 0, realProviderCalls: 0 }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
