import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "../frontend/node_modules/vite/dist/node/index.js";
import React from "../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../frontend/node_modules/react-dom/server.node.js";
const server = await createServer({root:fileURLToPath(new URL("../frontend",import.meta.url)),configFile:false,esbuild:{jsx:"automatic"},server:{middlewareMode:true,ws:false},appType:"custom",optimizeDeps:{noDiscovery:true}});
try {
 const {default:Table}=await server.ssrLoadModule("/src/components/ProviderTable.tsx");
 const {default:Audio}=await server.ssrLoadModule("/src/components/AudioPanel.tsx");
 const report=JSON.parse(await readFile(new URL("./fixtures/workshop-review/illustration_1.json",import.meta.url),"utf8"));
 const before=JSON.stringify(report);
 const html=renderToStaticMarkup(React.createElement(Table,{providers:report.providers}));
 assert.equal((html.match(/role="cell"/g)||[]).length,report.providers.length*7);
 for(const provider of report.providers) assert.ok(html.includes(provider.name));
 for(const label of ["Provider","Type","Status","Verdict","Synthetic rating","Check confidence","Key evidence"]) assert.ok(html.includes(`aria-hidden="true">${label}</span>`));
 for(const status of ["ok","error","timeout","unconfigured","disabled"]) {
  const provider={...report.providers[0],status,verdict:"inconclusive",rating:null,summary:"Recorded status retained"};
  const h=renderToStaticMarkup(React.createElement(Table,{providers:[provider]}));
  assert.ok(h.includes(`>${status}</span>`)); assert.match(h,/inconclusive/i); assert.ok(h.includes("n/a"));
 }
 assert.ok(renderToStaticMarkup(React.createElement(Table,{providers:[]})).includes("No analysis yet."));
 const audio=renderToStaticMarkup(React.createElement(Audio,{report}));
 assert.equal((audio.match(/role="cell"/g)||[]).length,16);
 for(const name of ["Local soundtrack","Google Gemini","Suno Credentials","Original-file C2PA"]) assert.ok(audio.includes(name));
 assert.ok(audio.includes("AI-origin detection from the sound itself is outside this workflow."));
 assert.equal(JSON.stringify(report),before);
 console.log("Responsive result checks passed: all provider fields, status distinctions, empty and audio records preserved.");
} finally { await server.close(); }
