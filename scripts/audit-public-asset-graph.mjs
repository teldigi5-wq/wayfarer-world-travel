/* Integration-level public asset dependency graph.
 * Checks direct literal browser references through source HTML/CSS/JS.
 * Dynamic JS-computed URLs, external CDNs and runtime API behavior still
 * require actual browser and Vercel Preview verification.
 */
import {readFile} from 'node:fs/promises';
import {PUBLIC_STATIC_FILES,PUBLIC_STATIC_SET} from '../public-static-assets.mjs';

function localReference(raw){
 if(typeof raw!=='string')return null;
 const s=raw.trim().replace(/^['"]|['"]$/g,'').trim();
 if(!s||/^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/|var\(|about:)/i.test(s))
   return null;
 const value=s.split(/[?#]/)[0].replace(/^\.\//,'').replace(/^\//,'');
 if(!value||value.includes('/')||value.includes('\\')||
   !/^[a-zA-Z0-9_.-]+$/.test(value)||value.startsWith('.'))return null;
 // Only inspect actual file-like browser asset references, not routes or
 // arbitrary copy text. Root-relative /api always remains a serverless path.
 if(!/\.(?:html|js|css|json|svg|jpg|jpeg|png|webp|xml|txt)$/i.test(value))
   return null;
 return value;
}
export function directClientDependencies(filename,contents){
 const refs=new Set();
 const add=raw=>{const v=localReference(raw);if(v)refs.add(v);};
 if(filename.endsWith('.html')){
   for(const m of contents.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi))
     add(m[1]);
 }
 if(filename.endsWith('.css')){
   for(const m of contents.matchAll(/url\(\s*(['"]?)([^)"']+)\1\s*\)/gi))add(m[2]);
 }
 if(filename.endsWith('.js')){
   // Literal ES module imports or dynamic import("...") and direct fetch.
   for(const m of contents.matchAll(/\bimport\s*(?:\(\s*|[^;\n]*?\bfrom\s*)?["']([^"']+)["']/g))
     add(m[1]);
   for(const m of contents.matchAll(/\bfetch\s*\(\s*["'`]([^"'`]+)["'`]/g))
     add(m[1]);
   for(const m of contents.matchAll(/\bnew\s+URL\s*\(\s*["']([^"']+)["']/g))
     add(m[1]);
   // Plain literal root file references used by catalog/image fallback
   // loaders (not every JS expression is statically discoverable).
   for(const m of contents.matchAll(/["'`]((?:\.\/|\/)?[a-zA-Z0-9_.-]+\.(?:json|css|js|jpg|jpeg|png|webp|svg))(?:(?:\?[^"'`]*)?)["'`]/g))
     add(m[1]);
 }
 return [...refs].sort();
}
export async function auditPublicAssetGraph({read=async name=>
 readFile(new URL('../'+name,import.meta.url),'utf8'),files=PUBLIC_STATIC_FILES}={}){
 const declared=new Set(files),missing=[],edges=[],inspected=[];
 if(declared.size!==files.length)missing.push({from:'manifest',asset:'duplicate-file'});
 for(const file of files.filter(name=>/\.(?:html|css|js)$/i.test(name))){
   let source;
   try{source=await read(file)}catch{
     missing.push({from:'manifest',asset:file});continue;
   }
   inspected.push(file);
   for(const dependency of directClientDependencies(file,source)){
     edges.push({from:file,to:dependency});
     if(!declared.has(dependency))missing.push({from:file,asset:dependency});
   }
 }
 return {ok:missing.length===0,manifestFiles:declared.size,
   inspectedFiles:inspected.length,edgeCount:edges.length,
   missing,edges,
   limitation:'Direct literal HTML/CSS/JS local references only; computed URLs, Vercel API packaging, browser execution and external CDNs need separate checks.'};
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 const report=await auditPublicAssetGraph();
 console.log(JSON.stringify({ok:report.ok,manifestFiles:report.manifestFiles,
  inspectedFiles:report.inspectedFiles,edgeCount:report.edgeCount,missing:report.missing,
  limitation:report.limitation},null,2));
 if(!report.ok)process.exitCode=1;
}
