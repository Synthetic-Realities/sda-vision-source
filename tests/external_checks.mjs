import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from '../frontend/node_modules/react/index.js';
import { renderToStaticMarkup as render } from '../frontend/node_modules/react-dom/server.node.js';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
const server = await createServer({root:fileURLToPath(new URL('../frontend',import.meta.url)),configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
  const { detectorMaterials, acceptsDetectorFile } = await server.ssrLoadModule('/src/detectorMaterial.ts');
  const { externalCheckRows, externalChecksMarkdown, updateDemoDetectorReplies, demoDetectorReplyRows, demoDetectorRepliesMarkdown } = await server.ssrLoadModule('/src/externalChecks.ts');
  const { SHOWCASE } = await server.ssrLoadModule('/src/showcase.ts');
  const { sessionNotes, updateSessionNotes } = await server.ssrLoadModule('/src/sessionNotes.ts');
  const { buildSessionExport } = await server.ssrLoadModule('/src/sessionExport.ts');
  const { default: Check } = await server.ssrLoadModule('/src/components/ExternalWatermarkCheck.tsx');
  const { default: DemoChecks } = await server.ssrLoadModule('/src/components/DemoExternalChecks.tsx');
  const report = JSON.parse(await readFile(new URL('./fixtures/workshop-review/podcast.json', import.meta.url)));
  const original = JSON.stringify(report);
  const rawReply = 'TEST ONLY: Something went wrong. <img src="https://untrusted.invalid/">\nPASTED REPLY END';
  const openaiReply = 'TEST ONLY: OpenAI check failed. <script>untrusted</script> OPENAI REPLY END';
  const [audio] = detectorMaterials(report, '/local/podcast.m4a');
  let replies = updateDemoDetectorReplies([], report, audio, rawReply);
  assert.equal(replies[0].response, rawReply);
  assert.equal(replies[0].source_sha256, report.meta.input_sha256);
  assert.equal(replies[0].offered_filename, report.meta.filename);
  for (const field of ['status', 'score', 'rating', 'checked_sha256', 'checked_at']) assert(!(field in replies[0]));
  const otherMaterial = {...audio, id:'other-prepared-image', filename:'slide-2.jpg', label:'Slide 2'};
  replies = updateDemoDetectorReplies(replies, report, otherMaterial, 'TEST ONLY: second material');
  assert.equal(replies.length, 2);
  assert.equal(replies.find(reply=>reply.material_id===audio.id).response, rawReply);
  assert.equal(updateDemoDetectorReplies(replies, report, audio, '').length, 1);
  assert.equal(updateDemoDetectorReplies([], report, audio, 'x'.repeat(20001))[0].response.length, 20000);
  assert(demoDetectorReplyRows(replies[0]).some(([key])=>key==='Offered SHA-256'));
  assert(demoDetectorRepliesMarkdown(replies).includes('\\<img'));
  updateSessionNotes(report,{synthidReplies:replies,openai:openaiReply});
  assert.equal(sessionNotes(structuredClone(report)).synthidReplies, undefined);
  assert.equal(sessionNotes(structuredClone(report)).openai, '');
  for (const kind of ['image','audio','video','pdf','pptx']) {
    const example = structuredClone(report); example.meta.kind = kind;
    const pair = render(React.createElement(DemoChecks, {report:example,originalUrl:'/prepared/example',replies,
      onReplyChange:()=>{},openai:openaiReply,onOpenai:()=>{}}));
    assert.equal((pair.match(/<textarea/g)||[]).length,2);
    assert.match(pair,/SynthID results/); assert.match(pair,/OpenAI results/);
    assert.match(pair,/OPENAI REPLY END/); assert.match(pair,/&lt;script/);
    assert.match(pair,/href="https:\/\/synthid.com\/"/);
    assert.match(pair,/terms and any charges/); assert.match(pair,/Opening a link sends no media/);
    assert.doesNotMatch(pair,/<details|type="(?:file|datetime-local|checkbox)"|gemini.google|Copy prompt|Save external check|<script>/);
    if(kind==='image') assert.match(pair,/href="https:\/\/openai.com\/research\/verify\/"/);
    else { assert.doesNotMatch(pair,/href="https:\/\/openai.com/); assert.match(pair,/disabled="">OpenAI checker: images only/); }
    if(kind==='audio') assert.match(pair,/PASTED REPLY END/);
  }
  if (SHOWCASE) {
    const {default: Results} = await server.ssrLoadModule('/src/components/Results.tsx');
    const integrated = render(React.createElement(Results,{report,previewName:report.meta.filename,originalUrl:'/podcast.m4a'}));
    assert.match(integrated,/demo-checker-pair/);
    assert.match(integrated,/PASTED REPLY END/); assert.match(integrated,/OPENAI REPLY END/);
    assert.doesNotMatch(integrated,/gemini.google|OpenAI image checker and Gemini|SynthID Detector reply \(paste result\)|type="file"/);
    const communitySource=await readFile(new URL('../frontend/src/components/CommunityView.tsx',import.meta.url),'utf8');
    assert.match(communitySource,/SHOWCASE \? <div ref=\{p.onSecondOpinionTarget\} \/>/);
  }
  const demoMarkup=render(React.createElement(Check,{report,originalUrl:'/podcast.m4a',checks:[],onChange:()=>{},replies,onReplyChange:()=>{}}));
  if (SHOWCASE) {
    assert.match(demoMarkup,/SynthID Detector reply \(paste result\)/);
    assert.match(demoMarkup,/PASTED REPLY END/);
    assert.doesNotMatch(demoMarkup, /type="(?:file|datetime-local|checkbox)"|Save external check|Record the external result/);
    assert.doesNotMatch(demoMarkup, /<img src="https:\/\/untrusted/);
  } else {
    assert.match(demoMarkup,/type="file"/);
    assert.match(demoMarkup,/Save external check/);
    assert.match(demoMarkup,/type="checkbox"/);
  }
  const resultsSource = await readFile(new URL('../frontend/src/components/Results.tsx', import.meta.url),'utf8');
  assert(resultsSource.includes('<summary>OpenAI image checker and Gemini</summary>'));
  const {default: SecondOpinion}=await server.ssrLoadModule('/src/components/SecondOpinion.tsx');
  const checkerHtml=render(React.createElement(SecondOpinion,{filename:'example.png',kind:'image',community:true,onGemini:()=>{},onChatgpt:()=>{}}));
  assert.match(checkerHtml,/OpenAI images check/);
  assert.match(checkerHtml,/OpenAI reply \(paste result\)/);
  for(const name of ['one.PNG','podcast.m4a','video.mp4']) assert(acceptsDetectorFile(name));
  for(const name of ['deck.pptx','document.pdf','notes.txt','image.svg']) assert(!acceptsDetectorFile(name));
  assert.equal(detectorMaterials(report,'/local/podcast.m4a').length, 1);
  const doc = structuredClone(report); doc.meta.kind='pdf'; doc.meta.filename='infographic.pdf'; doc.meta.input_sha256='02915f051b6eb2c9ef0c21f5bb20c4229ca21324bf20172f3867c32c299a5924';
  const [page] = detectorMaterials(doc, '/local/infographic.pdf');
  assert.equal(page.label,'PDF page 1 (rendered image)'); assert.equal(page.relationship,'derived_image');
  doc.meta.kind='pptx'; doc.meta.input_sha256='d0ec89da564078611922195fca82364f2f8e63d253d02a6d9bb672a8265c5f15';
  assert.equal(detectorMaterials(doc).length,14);
  doc.meta.input_sha256='different-file'; assert.equal(detectorMaterials(doc).length,0);
  const value={schema_version:'external-check-v1',id:'test',service:'SynthID Detector',service_url:'https://synthid.com/',entry_method:'manual',status:'failed',checked_at:'2026-10-11T12:00:00Z',recorded_at:'2026-10-11T12:01:00Z',operator:'Test',source_filename:report.meta.filename,source_sha256:report.meta.input_sha256,checked_filename:'test.m4a',checked_sha256:'a'.repeat(64),checked_bytes:42,relationship:'participant_selected',material_label:'Chosen audio',reported_scope:'Not specified',reported_origin:'',response:'TEST: <img src="https://untrusted.invalid/">\nRAW END'};
  updateSessionNotes(report,{externalChecks:[value]});
  assert.equal(JSON.stringify(report),original);
  assert.equal(sessionNotes(structuredClone(report)).externalChecks,undefined);
  for (const status of ['detected','not_detected','inconclusive','unsupported','failed','not_checked']) {
    const item={...value,status};
    const html=render(React.createElement(Check,{report,originalUrl:'/podcast.m4a',checks:[item],onChange:()=>{}}));
    assert.match(html,/href="https:\/\/synthid.com\/" target="_blank" rel="noopener noreferrer"/);
    assert.match(html,/Opening this link sends no media/);
    assert.match(html,/&lt;img/); assert.doesNotMatch(html,/<img src="https:\/\/untrusted/);
    assert(externalCheckRows(item).some(row=>row[0]==='Checked SHA-256'));
    assert(externalChecksMarkdown([item]).includes('RAW END'));
  }
  for(const format of ['json','csv','md']) {
    const output=await (await buildSessionExport([report],format)).text();
    assert(output.includes('RAW END')); assert(output.includes(value.checked_sha256));
    assert(output.includes('PASTED REPLY END')); assert(output.includes('second material'));
    assert(output.includes('OPENAI REPLY END'));
    assert(output.includes('SynthID Detector')); assert(output.includes('offered_filename') || output.includes('Offered filename'));
  }
  const originalFetch = globalThis.fetch;
  const assets = fileURLToPath(new URL('../frontend/src/assets', import.meta.url));
  globalThis.fetch = async url => {
    assert.equal(typeof url, 'string');
    assert(url.startsWith('/src/assets/'), 'Exports must load only bundled assets in this test');
    const path = resolve(assets, url.slice('/src/assets/'.length).split('?')[0]);
    assert(path.startsWith(assets + sep));
    return new Response(await readFile(path));
  };
  try {
    for (const format of ['pdf', 'pptx']) {
      const output = Buffer.from(await (await buildSessionExport([report], format)).arrayBuffer());
      assert(output.length > 1000);
      assert.equal(output.subarray(0, format === 'pdf' ? 4 : 2).toString(), format === 'pdf' ? '%PDF' : 'PK');
      if (process.env.SDA_TEST_EXPORT_DIR) {
        await mkdir(process.env.SDA_TEST_EXPORT_DIR, {recursive:true});
        await writeFile(resolve(process.env.SDA_TEST_EXPORT_DIR, `paste-only-session.${format}`), output);
      }
    }
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(JSON.stringify(report),original);
  console.log('External checks: visible checker pair, demo Gemini removal, format scope, file binding, escaped replies, export retention, session isolation and status displays passed.');
} finally { await server.close(); }
