// Runs against a separately served static build. All non-static requests fail.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.SHOWCASE_URL || 'http://127.0.0.1:8768/dist-showcase/';
const out = path.resolve(process.env.DEMO_OUTPUT || '.review-cache/demo-implementation-2026-09-26/browser');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const requests = [], forbidden = [], errors = [];
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url());
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
    requests.push({ method: req.method(), path: url.pathname });
    if (url.origin !== new URL(base).origin || req.method() !== 'GET' || /\/api\//.test(url.pathname)) {
      forbidden.push(req.url()); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.goto(base);
    assert.equal(await page.getByRole('radio', { name: 'Community Workshop', exact: true }).isChecked(), true);
    await page.locator('.community-heading .public-demo-note').waitFor();
    await page.getByRole('radio', { name: 'Developer', exact: true }).check();
    await page.locator('.example-btn').first().waitFor();
    for (const view of ['Developer', 'Community Workshop', 'Train the trainer / Researcher']) {
      await page.getByRole('radio', { name: view, exact: true }).check();
      assert.equal(await page.locator('input[type=file]').count(), 0, `${view} must have no upload input, including hidden ones`);
    }
    await page.getByRole('radio', { name: 'Developer', exact: true }).check();
    const dropPrevented = await page.locator('.presentation-shell').evaluate(element => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['visitor bytes'], 'visitor.png', { type: 'image/png' }));
      return !element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    assert.equal(dropPrevented, true, 'Dropped visitor files must not navigate or enter the workflow');
    const name = await page.locator('.example-btn').first().textContent();
    const manifest = await (await page.request.get(new URL('showcase/manifest.json', base).href)).json();
    const entry = manifest.examples.find(e => e.name === name);
    const original = await (await page.request.get(new URL('showcase/' + entry.report, base).href)).json();
    await page.locator('.example-btn').first().click();
    await page.getByRole('button', { name: 'Open saved results', exact: true }).click();
    await page.locator('.so-paste textarea').first().waitFor();
    const marker = 'SESSION NOTE END';
    const note = '=Formula-like text; <img src="https://invalid.example/visitor" onerror="alert(1)">\n'
      + '```\n![pasted Markdown](https://invalid.example/markdown)\n```\n'
      + 'A visitor describes the coverage and uncertainty of this external check. '.repeat(65) + marker;
    await page.locator('.so-paste textarea').first().fill(note);
    await page.locator('.so-paste textarea').nth(1).fill('OpenAI visitor reply — CHECK END');
    await page.locator('.so-attest select').first().selectOption('yes');
    assert.equal(await page.getByRole('button', { name: 'Add note to scoring', exact: true }).count(), 0);
    async function save(label, filename, scope = page) {
      const event = page.waitForEvent('download');
      await scope.getByRole('button', { name: label, exact: true }).click();
      const download = await event;
      assert.equal(await download.failure(), null);
      const target = path.join(out, filename); await download.saveAs(target);
      return fs.readFileSync(target);
    }
    const json = JSON.parse(await save('Session JSON', 'single.json'));
    assert.deepEqual(json.items[0].recorded_analysis, original, 'Session edits must not change the stored report');
    assert.equal(json.items[0].visitor_notes.gemini, note);
    assert.equal(json.items[0].visitor_notes.geminiFresh, true);
    for (const format of ['Markdown', 'CSV', 'PDF', 'PPTX']) {
      const ext = format === 'Markdown' ? 'md' : format.toLowerCase();
      const bytes = await save(`Session ${format}`, `single.${ext}`);
      if (['md', 'csv'].includes(ext)) assert.ok(bytes.toString().includes(marker));
      if (ext === 'md') {
        const { marked } = await import(path.resolve('frontend/node_modules/marked/lib/marked.esm.js'));
        assert.ok(!marked.parse(bytes.toString()).includes('<img'), 'Pasted HTML/Markdown must stay literal data');
      }
      if (ext === 'csv') assert.match(bytes.toString(), /'=Formula-like/);
      if (ext === 'pdf') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      if (ext === 'pptx') assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    }
    await page.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
    await page.locator('.community-steps button').filter({ hasText: 'Check' }).click();
    const reply = page.locator('.community-opinion-reply').first();
    await reply.locator('summary').first().click();
    assert.equal(await reply.locator('textarea').inputValue(), note, 'View switching preserves session note');
    await page.getByRole('radio', { name: 'Train the trainer / Researcher', exact: true }).check();
    assert.equal(await page.locator('input[type=file]').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(out, 'public-mobile.png'), fullPage: true });
    await page.getByRole('radio', { name: 'Developer', exact: true }).check();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.so-paste textarea').first().fill('');
    assert.equal(await page.locator('.so-attest select').first().inputValue(), '');
    for (const item of manifest.examples.slice(0, 6)) {
      await page.getByRole('combobox', { name: 'Batch example', exact: true }).selectOption(item.name);
      await page.getByRole('button', { name: /^Add example/ }).click();
      await page.getByRole('combobox', { name: 'Batch example', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('[aria-label="Batch example"]').disabled);
    }
    await page.getByRole('button', { name: 'Select up to 5', exact: true }).click();
    assert.equal(await page.locator('.queue-list input:checked').count(), 5);
    await page.getByRole('button', { name: 'Open saved batch (5)', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.batch-item').length === 5 && document.querySelectorAll('.qrow.run').length === 5);
    assert.match(await page.locator('.batch-next').textContent(), /full cached example set/);
    await page.locator('.batch-item-head').first().click();
    await page.locator('.batch-detail .so-paste textarea').first().fill('Batch visitor note');
    const batchJson = JSON.parse(await save('Session JSON', 'batch.json', page.locator('.results-panel > .consensus').first()));
    assert.equal(batchJson.items.length, 5);
    assert.equal(batchJson.items[0].visitor_notes.gemini, 'Batch visitor note');
    assert.equal(batchJson.items[0].recorded_analysis.second_opinion_gemini, original.second_opinion_gemini);
    await page.screenshot({ path: path.join(out, 'public-batch-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Developer batch fits mobile viewport');
    await page.screenshot({ path: path.join(out, 'public-batch-mobile.png'), fullPage: true });
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Clear batch', exact: true }).click();
    assert.equal(await page.locator('.batch-item').count(), 0);
    await page.reload();
    await page.locator('.example-btn').first().click();
    await page.getByRole('button', { name: 'Open saved results', exact: true }).click();
    await page.locator('.so-paste textarea').first().waitFor();
    assert.equal(await page.locator('.so-paste textarea').first().inputValue(), '');
    assert.deepEqual(forbidden, []);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'network.json'), JSON.stringify({ base, requests, forbidden, errors }, null, 2));
    console.log(JSON.stringify({ ok: true, requests: requests.length, providerOrApiRequests: forbidden.length, exports: out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
