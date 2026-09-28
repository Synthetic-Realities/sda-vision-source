// Local-only export checks. Network analysis is replaced with fixture responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { mock, report } = require('./browser_community_views.cjs');
const out = path.resolve(process.env.EXPORT_OUTPUT || '.review-cache/polished-exports-2026-09-25');
const base = process.env.COMMUNITY_URL || 'http://127.0.0.1:8100';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [], requests = [], external = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin !== new URL(base).origin) {
        external.push(route.request().url()); return route.abort();
      }
      return route.continue();
    });
    await mock(page, requests, errors);
    await page.goto(base);
    await page.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
    await page.getByLabel('Workshop example', { exact: true }).selectOption('workshop-example.png');
    await page.getByRole('checkbox', { name: 'Human-made', exact: true }).check();
    await page.getByRole('button', { name: '4 Reflect', exact: true }).click();
    const note = page.getByLabel('What will you take away? (optional)', { exact: true });
    const longNote = 'Review the source, date and context together. '.repeat(90) + 'END OF PARTICIPANT NOTE';
    await note.fill(longNote);
    const format = page.locator('.community-downloads select');
    assert.equal(await format.inputValue(), 'pdf');
    assert.equal(await page.getByRole('checkbox', { name: 'Include my workshop responses in the summary', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('button', { name: /Print \/ save PDF/ }).count(), 0);
    async function save(button, filename) {
      const event = page.waitForEvent('download'); await button.click();
      const download = await event; await download.saveAs(path.join(out, filename));
      return fs.readFileSync(path.join(out, filename));
    }
    for (const type of ['pdf', 'pptx', 'csv']) {
      await format.selectOption(type);
      const bytes = await save(page.getByRole('button', { name: 'End session', exact: true }), `workshop-before-analysis.${type}`);
      assert.equal(await note.inputValue(), longNote, 'Ending the session preserves notes');
      if (type === 'pdf') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      if (type === 'pptx') assert.equal(bytes.subarray(0, 2).toString(), 'PK');
      if (type === 'csv') assert.match(bytes.toString(), /no completed report is available/);
    }
    await note.fill('Unsupported character test: 🧪');
    await format.selectOption('pdf');
    await page.getByRole('button', { name: 'End session', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Choose CSV to keep all original text' }).first().waitFor();
    assert.equal(await note.inputValue(), 'Unsupported character test: 🧪');
    await note.fill(longNote);
    await page.getByRole('button', { name: '3 Check', exact: true }).click();
    await page.getByRole('checkbox', { name: /^I agree to send/ }).check();
    await page.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
    await page.locator('.community-provider-details').waitFor();
    assert.equal(await page.locator('.community-provider-details').evaluate(el => el.open), true);
    assert.equal(await page.locator('.community-takeaway').count(), 0);
    assert.equal(await page.locator('.community-provider-details').evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(245, 121, 22)');
    for (const type of ['pdf', 'pptx', 'csv']) {
      await format.selectOption(type);
      await save(page.getByRole('button', { name: `Download ${type.toUpperCase()}`, exact: true }), `workshop-findings.${type}`);
    }
    fs.writeFileSync(path.join(out, 'fixture-report.json'), JSON.stringify(report(), null, 2));
    await page.getByRole('button', { name: '4 Reflect', exact: true }).click();
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Start new session', exact: true }).isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await note.inputValue(), longNote);
    await page.getByRole('button', { name: 'New session', exact: true }).click();
    await page.getByRole('dialog').getByRole('checkbox', { name: 'I am ready to clear this page and start a new session' }).check();
    await page.getByRole('button', { name: 'Start new session', exact: true }).click();
    assert.equal(await page.getByLabel('Workshop example', { exact: true }).inputValue(), '');
    assert.equal(await page.locator('.community-evidence-box').count(), 0);
    for (const kind of ['video', 'audio', 'pdf', 'pptx', 'text', 'missing-preview']) {
      const mediaPage = await browser.newPage();
      mediaPage.on('pageerror', e => errors.push(e.message));
      await mock(mediaPage, requests, errors, r => ({ ...r, meta: { ...r.meta,
        kind: kind === 'missing-preview' ? 'audio' : kind,
        thumbnail: ['text', 'missing-preview'].includes(kind) ? undefined : r.meta.thumbnail },
      }));
      await mediaPage.goto(base);
      await mediaPage.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
      await mediaPage.getByLabel('Workshop example', { exact: true }).selectOption('workshop-example.png');
      await mediaPage.getByRole('button', { name: '3 Check', exact: true }).click();
      await mediaPage.getByRole('checkbox', { name: /^I agree to send/ }).check();
      await mediaPage.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
      await mediaPage.locator('.community-provider-details').waitFor();
      // Remove the example thumbnail for the genuine missing-preview case.
      if (kind === 'missing-preview') {
        await mediaPage.route('**/api/examples/thumb*', route => route.fulfill({ contentType: 'application/json', body: '{"thumb":null}' }));
        await mediaPage.getByLabel('Workshop example', { exact: true }).selectOption('second-example.png');
        await mediaPage.getByRole('button', { name: '3 Check', exact: true }).click();
        await mediaPage.getByRole('checkbox', { name: /^I agree to send/ }).check();
        await mediaPage.getByRole('button', { name: "Run SDA's checks", exact: true }).click();
        await mediaPage.locator('.community-provider-details').waitFor();
      }
      for (const type of ['pdf', 'pptx']) {
        await mediaPage.locator('.community-downloads select').selectOption(type);
        const event = mediaPage.waitForEvent('download');
        await mediaPage.getByRole('button', { name: `Download ${type.toUpperCase()}`, exact: true }).click();
        await (await event).saveAs(path.join(out, `media-${kind}.${type}`));
      }
      await mediaPage.close();
    }
    assert.equal(requests.filter(p => p.startsWith('/api/export/')).length, 0, 'Workshop responses stay browser-side');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ ok: true, formats: ['pdf', 'pptx', 'csv'], localOnly: true, notesPreserved: true, outputs: out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
