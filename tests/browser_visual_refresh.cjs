// Local presentation checks. Only fixture reads and a mocked graph are allowed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const out = path.resolve(__dirname, '../.review-cache/visual-refresh-2026-09-24/themes');
fs.mkdirSync(out, { recursive: true });
const ready = { configured: true, state: 'ready', model: 'fixture' };
const info = { version: 'test', dev_mode: true, vaccine_lens: true, corpus_available: false,
  claude: ready, openai: ready, gemini: ready, c2pa: ready, local: ready };

function luminance(hex) {
  const rgb = hex.trim().replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [], pairs = [], requests = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      requests.push(url.pathname);
      const bodies = { '/api/providers': info, '/api/examples': { files: [] }, '/api/corpus': { available: false, labels: [] },
        '/api/diffusion': { source: 'example', nodes: [], edges: [], stats: { nodes: 0, edges: 0, clusters: 0, largest_cluster: 0 } } };
      if (!(url.pathname in bodies)) { errors.push(`Unexpected API ${url.pathname}`); return route.abort(); }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(bodies[url.pathname]) });
    });
    await page.goto(base);
    await page.getByRole('combobox', { name: 'Colour theme' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'studio');
    assert.equal(await page.getByRole('combobox', { name: 'Colour theme' }).inputValue(), 'studio');

    for (const theme of ['studio', 'console', 'light', 'ppie', 'dark', 'pulse']) {
      await page.getByRole('combobox', { name: 'Colour theme' }).selectOption(theme);
      assert.equal(await page.evaluate(() => localStorage.getItem('sda-theme')), theme);
      for (const [name, width, height] of [['desktop',1440,1000], ['tablet-landscape',1024,768], ['tablet-portrait',768,1024], ['phone',390,844], ['small-phone',320,740]]) {
        await page.setViewportSize({ width, height });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${theme}/${name}: no page overflow`);
        await page.screenshot({ path: path.join(out, `developer-${theme}-${name}.png`), fullPage: true });
      }
      if (['studio', 'console', 'light', 'ppie'].includes(theme)) {
        const tokens = await page.evaluate(() => {
          const css = getComputedStyle(document.documentElement);
          return Object.fromEntries(['text','muted','accent','on-accent','pop','panel','panel-2','good','warn','danger','partial'].map(k => [k, css.getPropertyValue(`--${k}`).trim()]));
        });
        for (const [fg, bg] of [['text','panel'],['muted','panel'],['muted','panel-2'],['accent','panel'],['pop','panel'],['on-accent','accent'],['good','panel'],['danger','panel'],['partial','panel']]) {
          const ratio = contrast(tokens[fg], tokens[bg]);
          pairs.push({ theme, fg, bg, ratio: Number(ratio.toFixed(2)) });
          assert(ratio >= 4.5, `${theme}: ${fg}/${bg} contrast ${ratio}`);
        }
      }
    }

    await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('studio');
    for (const size of ['large','workshop','standard']) {
      await page.getByRole('button', { name: /^Text size:/ }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('sda-textsize')), size);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${size}: no overflow at 320px`);
    }
    await page.getByRole('radio', { name: 'Community Workshop', exact: true }).check();
    await page.locator('.community-preview img').evaluate(img => img.decode());
    assert.equal(await page.locator('.community-preview img').evaluate(img => img.naturalWidth), 1536);
    assert.equal(await page.getByRole('checkbox', { name: 'Not sure yet', exact: true }).isDisabled(), true);
    await page.getByRole('radio', { name: 'Developer', exact: true }).check();
    assert.equal(await page.getByRole('combobox', { name: 'Colour theme' }).inputValue(), 'studio');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'studio');
    assert.deepEqual(errors, []);
    const result = { ok: true, themes: 6, viewportsPerTheme: 5, contrastPairs: pairs,
      checks: ['Bright default and saved selections', 'Six Developer themes and responsive layouts', 'Large/workshop text at phone width', 'Repaired illustration; responses require a selected item', 'No analysis triggered'], realProviderCalls: 0, errors };
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, contrastPairs: pairs.length, screenshots: out }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
