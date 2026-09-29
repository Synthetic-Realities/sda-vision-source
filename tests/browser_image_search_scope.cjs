// Run against prepared public/workshop/research/conference builds. Every live API is mocked.
// SDA_TEST_BUILDS contains the four build directories; SDA_TEST_SITE contains the saved demo's site.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const builds = path.resolve(process.env.SDA_TEST_BUILDS);
const site = path.resolve(process.env.SDA_TEST_SITE);
const manifest = JSON.parse(fs.readFileSync(path.join(site, 'showcase/manifest.json')));
const examples = [...manifest.examples, manifest.workshop_starter].filter(Boolean);
const reportFor = name => JSON.parse(fs.readFileSync(path.join(site, 'showcase', examples.find(e => e.name === name).report)));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.m4a':'audio/mp4', '.mov':'video/quicktime', '.pdf':'application/pdf', '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.ttf':'font/ttf' };
const server = http.createServer((req,res) => {
  let file = path.resolve(builds, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(builds + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless:true });
  const checks = [], forbidden = [], errors = [];
  let mockedAnalyses = 0;
  try {
    for (const profile of (process.env.SDA_TEST_PROFILES || 'public,research,conference,workshop').split(',')) {
      const saved = ['public','workshop'].includes(profile);
      for (const width of [1440,390]) {
        const context = await browser.newContext({ viewport:{width,height:1000}, acceptDownloads:true });
        let selected = 'animal-portrait.jpg';
        const ready = {configured:true,state:'ready',model:'mock-model'};
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          if (!['http:','https:'].includes(url.protocol)) return route.continue();
          if (url.origin !== origin) { forbidden.push(req.url()); return route.abort(); }
          if (!url.pathname.startsWith('/api/')) return route.continue();
          if (saved) { forbidden.push(req.url()); return route.abort(); }
          let body;
          if (url.pathname === '/api/providers') body = {delivery_profile:profile==='conference'?'conference':'research',tool:'SDA Vision',version:'test',dev_mode:true,vaccine_lens:false,corpus_available:false,claude:ready,openai:ready,gemini:ready,c2pa:ready,local:ready,synthid:{configured:false,state:'unconfigured'}};
          else if (url.pathname === '/api/corpus') body = {available:false,labels:[]};
          else if (url.pathname === '/api/examples') body = {files:manifest.examples.map(e => ({name:e.name}))};
          else if (url.pathname === '/api/examples/file') {
            const name = url.searchParams.get('name');
            return route.fulfill({contentType:mime[path.extname(name)],body:fs.readFileSync(path.join(site,'showcase/originals',name))});
          } else if (url.pathname === '/api/examples/thumb') body = {thumb:reportFor(url.searchParams.get('name')).meta.thumbnail};
          else if (['/api/analyse','/api/conference/analyse'].includes(url.pathname)) { mockedAnalyses++; body = reportFor(selected); }
          else if (url.pathname === '/api/diffusion') body = {source:'item',nodes:[],edges:[],stats:{nodes:0,edges:0,clusters:0,largest_cluster:0}};
          else if (url.pathname === '/api/diffusion/summary') body = {summary:'Mocked graph summary',notes:[]};
          else { forbidden.push(req.url()); return route.abort(); }
          return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
        });
        const page = await context.newPage(); page.on('pageerror', e => errors.push(`${profile}: ${e.message}`));
        await page.goto(`${origin}/${profile}/`);
        for (const name of ['animal-portrait.jpg','infographic.pdf','podcast.m4a','presentation.pptx','animated-video.mov','journal-image.png']) {
          selected = name;
          await page.getByRole('radio',{name:'Community Workshop',exact:true}).check();
          if (!saved && profile !== 'conference') {
            // Exercise actual file-selection state as well as the catalogue used in the saved/conference profiles.
            await page.getByLabel('Choose a workshop file',{exact:true}).setInputFiles(path.join(site,'showcase/originals',name));
          } else await page.getByLabel('Workshop example',{exact:true}).selectOption(name);
          await page.locator('.example-loading').waitFor({state:'hidden'});
          await page.getByRole('button',{name:'3 Check',exact:true}).click();
          if (!saved) {
            for (const consent of await page.getByRole('checkbox',{name:/^I agree to send/}).all()) await consent.check();
          }
          await page.getByRole('button',{name:saved?'Open recorded findings':profile==='conference'?'Run live checks':"Run SDA's checks",exact:true}).click();
          await page.getByRole('heading',{name:'What the checks suggest',exact:true}).waitFor();
          const image = reportFor(name).meta.kind === 'image';
          assert.equal(await page.locator('.community-source-evidence').count(), image?1:0, `${profile}/${name}: evidence disclosure`);
          assert.equal(await page.locator('a[href="https://images.google.com/"]').count(), image?1:0);
          if (image) await page.locator('.community-source-evidence > summary').click();
          const download = page.getByRole('link',{name:'Download original file',exact:true}).first();
          assert.equal(await download.isVisible(),true,`${profile}/${name}: original download remains available`);
          await page.getByRole('button',{name:'4 Reflect',exact:true}).click();
          assert.equal(await page.locator('a[href="https://images.google.com/"]').count(),image?2:0);
          await page.getByRole('radio',{name:'Developer',exact:true}).check();
          assert.equal(await page.locator('a[href="https://images.google.com/"]').count(),0,'Developer must not inherit hidden workshop Lens links');
          if (saved) assert.equal(await page.locator('input[type="file"]').count(),0);
          checks.push({profile,width,name,lens:image?'image only':'absent',download:'available'});
        }
        console.log(`${profile} ${width}px: image → PDF → podcast → slides → video → image passed`);
        await context.close();
      }
    }
    assert.deepEqual(forbidden,[],'No external sends, real provider calls or unexpected endpoints');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(builds,`browser-results-${process.env.SDA_TEST_PROFILES || 'all'}.json`),JSON.stringify({checks,mockedAnalyses,realProviderCalls:0,externalRequests:forbidden,errors},null,2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; server.close(); });
