import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_STATIC_FILES} from '../public-static-assets.mjs';
import {auditPublicAssetGraph,directClientDependencies} from '../scripts/audit-public-asset-graph.mjs';
import {analyzeStack,fetchOpenPrStack} from '../scripts/audit-pr-stack.mjs';

const sha=n=>Number(n).toString(16).padStart(40,'0');
const branch=n=>'stage-'+n;
function createStack(size=4){
 return Array.from({length:size},(_,index)=>{
   const n=index+1;
   return {number:n,state:'open',draft:true,
     head:{ref:branch(n),sha:sha(n)},base:{ref:index===0?'main':branch(n-1)}};
 });
}
test('reviewed production build manifest has a consistent literal browser dependency closure',async()=>{
 const report=await auditPublicAssetGraph();
 assert.equal(report.ok,true,JSON.stringify(report.missing));
 assert.equal(report.manifestFiles,PUBLIC_STATIC_FILES.length);
 assert.equal(report.manifestFiles,40);
 assert.ok(report.inspectedFiles>=30);
 assert.ok(report.edgeCount>=12,'Expected public HTML and catalog asset references');
 assert.ok(report.edges.some(e=>e.to==='country-atlas.json'));
 assert.ok(report.edges.some(e=>e.to==='data-and-privacy.html'));
});
test('browser literal dependency analysis ignores external sources and API calls but catches local missing files',()=>{
 const html='<a href="data-and-privacy.html">Privacy</a>'+
   '<script src="./app.js"></script><img src="https://images.example.org/pic.jpg">'+
   '<a href="mailto:someone@example.invalid">Mail</a>';
 assert.deepEqual(directClientDependencies('index.html',html),
   ['app.js','data-and-privacy.html']);
 const css='body{background:url("logo.svg")} x{background:url(data:image/svg+xml;base64,AAAA)}';
 assert.deepEqual(directClientDependencies('site.css',css),['logo.svg']);
 const js="import './chart.js';fetch('/api/intelligence?x=3');fetch('data.json')";
 assert.deepEqual(directClientDependencies('app.js',js),['chart.js','data.json']);
});
test('a broken static import or linked image fails the generated browser asset closure',async()=>{
 const files=['index.html','main.js'];
 const fake={
   'index.html':'<script src="main.js"></script>',
   'main.js':'import "./secret-server.mjs"; const cover="missing-cover.webp";'
 };
 const result=await auditPublicAssetGraph({files,read:async file=>fake[file]});
 assert.equal(result.ok,false);
 assert.ok(result.missing.some(x=>x.asset==='missing-cover.webp'));
 assert.ok(result.missing.some(x=>x.asset==='secret-server.mjs'));
});
test('single correctly linked draft PR chain is structurally consistent but never authorized to merge',()=>{
 const stack=createStack(5);
 const report=analyzeStack(stack,{expectedLatestBranch:'stage-5',expectedLatestSha:sha(5)});
 assert.equal(report.status,'CHAIN_STRUCTURALLY_CONSISTENT_REVIEW_REQUIRED');
 assert.equal(report.count,5);
 assert.deepEqual(report.orderedPrNumbers,[1,2,3,4,5]);
 assert.equal(report.mergeAuthorized,false);
 assert.equal(report.productionAuthorized,false);
});
test('stack audit blocks non-draft PRs, forks, missing ancestors and unexpected head revisions',()=>{
 const example=createStack(4);
 const cases=[
   example.map((p,i)=>i===2?{...p,draft:false}:p),
   example.map((p,i)=>i===3?{...p,base:{ref:'stage-1'}}:p),
   example.map((p,i)=>i===0?{...p,base:{ref:'arbitrary'}}:p),
   example.map((p,i)=>i===2?{...p,head:{ref:p.head.ref,sha:'invalid'}}:p)
 ];
 for(const caseItem of cases)
   assert.equal(analyzeStack(caseItem).status,'BLOCKED');
 assert.equal(analyzeStack(example,{expectedLatestSha:sha(999)}).status,'BLOCKED');
 assert.equal(analyzeStack([]).status,'BLOCKED');
});
test('read-only GitHub stack data reader only fetches the public repo PR list and never mutates it',async()=>{
 const seen=[];
 const data=createStack();
 const fakeFetch=async(uri,options)=>{
   seen.push({uri,options});
   return {status:200,json:async()=>data};
 };
 const result=await fetchOpenPrStack({fetchFn:fakeFetch,token:''});
 assert.equal(result.length,4);
 assert.equal(seen.length,1);
 assert.equal(seen[0].options.method,'GET');
 assert.match(seen[0].uri,/\/repos\/teldigi5-wq\/wayfarer-world-travel\/pulls\?state=open/);
 assert.equal(seen[0].options.headers.Authorization,undefined);
});
test('stack audit fails closed on unreadable API, not an invented empty PR list',async()=>{
 const failing=async()=>({status:403,json:async()=>[]});
 await assert.rejects(fetchOpenPrStack({fetchFn:failing,token:''}),/unavailable/);
});
