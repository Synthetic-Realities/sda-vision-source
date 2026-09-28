import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js';
import React from '../frontend/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../frontend/node_modules/react-dom/server.node.js';
const server=await createServer({root:fileURLToPath(new URL('../frontend',import.meta.url)),configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
 const {fileRecordSummary,communitySummary}=await server.ssrLoadModule('/src/community.ts');
 const {summarySections,summaryCsv}=await server.ssrLoadModule('/src/workshopExport.ts');
 const {buildSessionExport}=await server.ssrLoadModule('/src/sessionExport.ts');
 const {updateSessionNotes}=await server.ssrLoadModule('/src/sessionNotes.ts');
 const {default:Summary}=await server.ssrLoadModule('/src/components/CommunityFindingSummary.tsx');
 const {default:SecondOpinion}=await server.ssrLoadModule('/src/components/SecondOpinion.tsx');
 const starter=JSON.parse(await readFile(new URL('./fixtures/workshop-review/illustration_1.json',import.meta.url)));
 const podcast=JSON.parse(await readFile(new URL('./fixtures/workshop-review/podcast.json',import.meta.url)));
 for(const report of [starter,podcast]) {
  const before=JSON.stringify(report);
  const html=render(React.createElement(Summary,{report,status:''}));
  assert.doesNotMatch(html,/Combined method confidence|recorded rule assigns|origin remains open/);
  assert(html.indexOf('community-file-record')>html.indexOf('Recorded checks and ratings'));
  assert.match(html,/<details class="credential-summary community-file-record">/);
  assert.match(html,/>About this file<\/summary>/);
  const summary=communitySummary(report,'','',true);
  const notes='\n## Second Opinion notes\nGemini reply: Preserved external reply.\n';
  const sections=summarySections(summary+notes);
  assert.equal(sections.at(-1).heading,'Session record');
  assert.equal(sections.at(-2).heading,'Second Opinion notes');
  assert(summary.indexOf('## About this file')>summary.indexOf('## Recorded checks'));
  assert.doesNotMatch(summaryCsv(sections),/combined method confidence|recorded rule assigns/i);
  assert.equal(summarySections(summary).at(-1).heading,'Session record');
  updateSessionNotes(report,{gemini:'Literal <img src="https://example.invalid/">',geminiFresh:true});
  for(const format of ['csv','md']) {
   const output=await (await buildSessionExport([report],format)).text();
   assert.doesNotMatch(output,/visitor|consensus\.confidence|recorded rule assigns/i);
   assert(output.indexOf('Session record')>output.indexOf('Second Opinion notes',output.indexOf('Recorded analysis')));
   assert(output.includes('medium')); // individual confidence retained
   assert(output.includes('example.invalid')); // pasted note preserved as data
  }
  const raw=JSON.parse(await (await buildSessionExport([report],'json')).text());
  assert.deepEqual(raw.items[0].recorded_analysis,report);
  assert.equal(JSON.stringify(report),before);
 }
 assert.match(fileRecordSummary(starter).lines.join(' '),/made with AI.*OpenAI.*signature checks out.*has not confirmed/);
 assert.match(fileRecordSummary(podcast).finding,/No creation label/);
 assert.doesNotMatch(fileRecordSummary(podcast).lines.join(' '),/source may help|origin remains open/);
 for(const integrity of ['absent','invalid','unknown']) {
  const r=structuredClone(starter);r.providers.find(p=>p.id==='c2pa').raw.validation.integrity=integrity;
  const text=JSON.stringify(fileRecordSummary(r));assert.doesNotMatch(text,/signature checks out/);
  if(integrity==='absent') assert.doesNotMatch(text,/OpenAI|made with AI/);
 }
 for(const status of ['error','timeout','disabled','pending','unconfigured']) {
  const r=structuredClone(starter);r.providers.find(p=>p.id==='c2pa').status=status;
  assert.doesNotMatch(JSON.stringify(fileRecordSummary(r)),/OpenAI|made with AI|signature checks out/);
 }
 const props={community:true,filename:'practice.png',kind:'image',originalUrl:'/originals/practice.png'};
 const html=render(React.createElement(SecondOpinion,props));
 assert.match(html,/href="\/originals\/practice.png" download="practice.png">Download original file/);
 assert(html.indexOf('Download original file')<html.indexOf('community-opinion-actions'));
 assert.doesNotMatch(render(React.createElement(SecondOpinion,{...props,originalUrl:undefined})),/Download original file/);
 console.log('Community language review passed: collapsed file labels, status and trust distinctions, export ordering, raw-record preservation, individual confidence and original download.');
} finally {await server.close();}
