import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
import React from '../frontend/node_modules/react/index.js';
import { renderToStaticMarkup } from '../frontend/node_modules/react-dom/server.node.js';
const server = await createServer({root:fileURLToPath(new URL('../frontend',import.meta.url)),configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
 const activity=await server.ssrLoadModule('/src/podcastActivity.ts');
 const {default:WorkshopActivity}=await server.ssrLoadModule('/src/components/WorkshopActivity.tsx');
 const {emptyWorkshopResponses}=await server.ssrLoadModule('/src/workshop.ts');
 const {prepareExportPreview}=await server.ssrLoadModule('/src/exportPreview.ts');
 const noop=()=>{};
 const props={kind:'audio',report:null,busy:false,responses:emptyWorkshopResponses(),onChange:noop,onNext:noop,onPrevious:noop,onReviewChecks:noop,onEndSession:noop,onNewSession:noop,onViewEvidence:noop,sessionStatus:''};
 assert.equal(activity.isPodcastExample(activity.PODCAST_SHA256),true);
 assert.equal(activity.isPodcastExample('unrelated','podcast.m4a'),false);
 assert.equal(activity.isPodcastExample(),false);
 for(const step of ['notice','discuss','check','reflect']) {
  const html=renderToStaticMarkup(React.createElement(WorkshopActivity,{...props,step,podcastExample:true}));
  assert.ok(html.includes(activity.PODCAST_PROMPTS[step]));
  assert.doesNotMatch(html,/Open Google Lens/);
  if(['notice','discuss'].includes(step)) assert.doesNotMatch(html,/NotebookLM|Final workshop verdict|Read the research paper|www.google.com/);
  else {
   assert.match(html,/href="https:\/\/www.google.com\/search\?q=[^"]+" target="_blank" rel="noopener noreferrer"/);
   assert.match(html,/href="https:\/\/doi.org\/10.1016\/j.vaccine.2021.10.031" target="_blank"/);
   assert.doesNotMatch(html,/<details[^>]*open/);
   assert.match(html,/Final workshop verdict: Mix of human and AI/);
  }
  for(const kind of ['audio','image','video','pdf','pptx','text']) {
   const other=renderToStaticMarkup(React.createElement(WorkshopActivity,{...props,step,kind,podcastExample:false}));
   assert.doesNotMatch(other,/Podcast source exploration|NotebookLM|Read the research paper/);
  }
 }
 assert.doesNotMatch(activity.podcastActivitySummary(false),/NotebookLM|Final workshop verdict|Source reveal: Project/);
 assert.match(activity.podcastActivitySummary(true),/Final workshop verdict: Mix of human and AI/);
 assert.match(activity.podcastActivitySummary(true),/saved ratings assess the transcript; the Sound tab separately describes an audio excerpt/);
 assert.match(activity.podcastActivitySummary(true),/NotebookLM/);
 assert.match(activity.podcastActivitySummary(true),/Read the paper: https:/);
 const old={window:globalThis.window,document:globalThis.document,Image:globalThis.Image};
 const seen=[];
 globalThis.window={location:{href:'http://localhost:8792/',origin:'http://localhost:8792'}};
 globalThis.Image=class {naturalWidth=1000;naturalHeight=500;set src(value){this.source=value;seen.push(value);queueMicrotask(()=>value.includes('broken')?this.onerror?.():this.onload?.());}};
 globalThis.document={createElement(){let image;return {getContext(){return {drawImage(img){image=img;}};},toDataURL(){return 'data:image/png;base64,'+Buffer.from(image.source).toString('base64');}};}};
 try {
  for(const kind of ['audio','pdf','pptx','video']) {
   const result=await prepareExportPreview({kind,thumbnail:'/recorded.png',analysed:true,displayedPreview:{url:'/displayed.png',caption:'Displayed cover'}});
   assert.equal(Buffer.from(result.image.dataUrl.split(',')[1],'base64').toString(),'/displayed.png');
   assert.equal(result.caption,'Displayed cover');
   const fallback=await prepareExportPreview({kind,thumbnail:'/recorded.png',analysed:true,displayedPreview:{url:'/broken.png',caption:'Displayed cover'}});
   assert.equal(Buffer.from(fallback.image.dataUrl.split(',')[1],'base64').toString(),'/recorded.png');
   assert.notEqual(fallback.caption,'Displayed cover');
  }
  const image=await prepareExportPreview({kind:'image',imageUrl:'blob:http://localhost:8792/original',thumbnail:'/tiny.png',analysed:true});
  assert.equal(Buffer.from(image.image.dataUrl.split(',')[1],'base64').toString(),'blob:http://localhost:8792/original');
  const count=seen.length;
  for(const kind of ['audio','pdf','pptx','video']) {
   const result=await prepareExportPreview({kind,thumbnail:'https://external.example/track.png',analysed:true,displayedPreview:{url:'data:image/svg+xml;base64,abc',caption:'bad'}});
   assert.equal(result.image,undefined);
  }
  assert.equal((await prepareExportPreview({kind:'text',analysed:true,thumbnail:'/ignored.png'})).image,undefined);
  assert.equal(seen.length,count,'Unsupported and external previews never load');
 } finally {for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
 console.log('Podcast stage/reveal isolation, external-link safety, preview selection/fallback for all media, and no external image requests passed.');
} finally {await server.close();}
