// Acceptance for the selected eleven-example checkpoint; every external request is blocked.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=process.cwd(),out=path.resolve(process.env.DEMO_OUTPUT || '.review-cache/example-coverage');const site=path.resolve(process.env.DEMO_SITE_DIR || 'site');fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
 try{
 const base=process.env.SHOWCASE_URL || 'http://127.0.0.1:8775/sda-vision/';const context=await browser.newContext({viewport:{width:1440,height:1000}}),blocked=[],errors=[];
 await context.route('**/*',route=>{const q=route.request(),u=new URL(q.url());if(['http:','https:'].includes(u.protocol)&&(u.origin!==new URL(base).origin||q.method()!=='GET'||u.pathname.includes('/api/'))){blocked.push(q.url());return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.example-btn').first().waitFor();
 assert.match(await page.locator('.showcase-banner').filter({hasText:'Coverage and analysis dates'}).innerText(),/Coverage and analysis dates are recorded with each result/);
 const manifest=await(await context.request.get(base+'showcase/manifest.json')).json();assert.equal(manifest.examples.length,11);assert.equal(await page.locator('.example-btn').count(),11);
 let downloads=0,local=0,saved=0;
 for(const e of manifest.examples){
  const report=await(await context.request.get(base+'showcase/'+e.report)).json();assert.equal(report.meta.method_version,'verdict-consistency-2026-09-26.1');
  const vision=report.providers.filter(p=>p.kind===(e.kind==='audio'?'analysis':'vision'));assert.equal(vision.length,3);
  await page.locator('.example-btn').filter({hasText:e.name}).click();await page.getByRole('button',{name:'Open saved results',exact:true}).click();
  await page.waitForFunction(name=>document.querySelector('.results-panel')?.textContent.includes(name),e.name);
  if(e.kind==='audio'){
   const audio=page.locator('audio.preview-audio');await audio.waitFor();
   await page.waitForFunction(()=>{const a=document.querySelector('audio.preview-audio');return a&&a.readyState>=1&&a.duration>1468&&a.duration<1470;});
   await audio.evaluate(async a=>{a.currentTime=10;await a.play();});
   await page.waitForFunction(()=>document.querySelector('audio.preview-audio').currentTime>10.1);
   await audio.evaluate(a=>a.pause());
   assert.match(await page.locator('.results-panel').innerText(),/transcript/i);
   assert.equal(await page.locator('input[type=file]').count(),0);
   await page.screenshot({path:path.join(out,'podcast-desktop.png')});
  }
  if(report.meta.models.length===0){
   local++;assert(vision.every(p=>p.status==='disabled'&&p.rating===null));assert.equal(report.consensus.overall_rating,null);assert.equal(report.consensus.overall_verdict,'inconclusive');
   await page.getByText('Local checks only.',{exact:false}).first().waitFor();assert.match(await page.locator('.results-panel').innerText(),/not (?:been )?run/i);
   await page.locator('.results-panel > .consensus').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'local-only-desktop.png')});
   await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.results-panel > .consensus').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'local-only-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  }else{saved++;assert.equal(report.meta.models.length,3);}
  for(const rel of ['showcase/originals/'+e.name,...['md','csv','pdf','pptx'].map(ext=>'showcase/exports/'+e.id+'.'+ext)]){
   const response=await context.request.get(base+rel);assert.equal(response.status(),200);assert((await response.body()).equals(fs.readFileSync(path.join(site,rel))));downloads++;
  }
 }
 assert.equal(local,3);assert.equal(saved,8);assert.equal(downloads,55);
 await page.getByRole('radio',{name:'Community Workshop',exact:true}).check();assert.equal(await page.locator('input[type=file]').count(),0);
 await page.goto(process.env.WORKSHOP_URL || new URL('../sda-vision-workshop/',base).href);await page.locator('.example-btn').first().waitFor();
 for(const view of ['Developer','Community Workshop','Train the trainer / Researcher']){await page.getByRole('radio',{name:view,exact:true}).check();assert.equal(await page.locator('input[type=file]').count(),0);}
 await page.getByRole('radio',{name:'Developer',exact:true}).check();await page.locator('.example-btn').filter({hasText:manifest.examples.find(e=>e.rating===null).name}).click();await page.getByRole('button',{name:'Open saved results',exact:true}).click();await page.getByText('Local checks only.',{exact:false}).first().waitFor();assert.equal(await page.locator('.so-paste textarea').count(),0);
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);const result={passed:true,examples:11,saved_llm_results:saved,local_checks_only:local,downloads_byte_matched:downloads,podcast_playback:true,workshop_views:3,provider_upload_requests:0,errors};fs.writeFileSync(path.join(out,'example-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
