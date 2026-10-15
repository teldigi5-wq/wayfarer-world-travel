/* Read-only Wayfarer draft PR train inspection.
 * No GitHub mutations, merges, changes to branch protections or deployments.
 * The API must be explicitly requested; normal tests use in-memory fixtures.
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const REPO='teldigi5-wq/wayfarer-world-travel';
export function analyzeStack(pulls,{expectedLatestBranch=null,expectedLatestSha=null}={}){
 if(!Array.isArray(pulls)||pulls.length===0)
   return {status:'BLOCKED',reason:'No open draft PR metadata found',count:0,issues:['empty-chain']};
 const selected=pulls.filter(p=>p&&p.state==='open'&&p.draft===true);
 const issues=[];
 if(selected.length!==pulls.length)issues.push('non-draft-or-closed-open-pr');
 const headNames=new Map();
 for(const p of selected){
   if(!Number.isInteger(p.number)||!p.head?.ref||!p.base?.ref||
      !/^[a-f0-9]{40}$/.test(p.head?.sha??'')){
     issues.push('malformed-pr-metadata');continue;
   }
   if(headNames.has(p.head.ref))issues.push('duplicate-head:'+p.number);
   else headNames.set(p.head.ref,p);
 }
 const byBase=new Map();
 for(const p of selected){
   if(!byBase.has(p.base?.ref))byBase.set(p.base?.ref,[]);
   byBase.get(p.base.ref).push(p);
 }
 const root=byBase.get('main')??[];
 if(root.length!==1)issues.push('expected-one-main-root');
 for(const [base,nodes] of byBase)if(nodes.length>1)
   issues.push('forked-base:'+base);
 const ordered=[],visited=new Set();
 let current=root.length===1?root[0]:null;
 while(current&&!visited.has(current.number)&&ordered.length<=pulls.length){
   visited.add(current.number);ordered.push(current);
   const children=byBase.get(current.head.ref)??[];
   current=children.length===1?children[0]:null;
 }
 if(current)issues.push('cycle');
 if(ordered.length!==selected.length)issues.push('disconnected-prs');
 if(ordered.length){
   const latest=ordered.at(-1);
   if(expectedLatestBranch&&latest.head.ref!==expectedLatestBranch)
     issues.push('latest-branch-mismatch');
   if(expectedLatestSha&&latest.head.sha!==expectedLatestSha)
     issues.push('latest-commit-mismatch');
 }
 return {
   status:issues.length?'BLOCKED':'CHAIN_STRUCTURALLY_CONSISTENT_REVIEW_REQUIRED',
   count:selected.length,issues,
   oldestPr:ordered[0]?.number??null,latestPr:ordered.at(-1)?.number??null,
   latestBranch:ordered.at(-1)?.head.ref??null,
   latestSha:ordered.at(-1)?.head.sha??null,
   orderedPrNumbers:ordered.map(p=>p.number),
   containsNonDraft:selected.length!==pulls.length,
   mergeAuthorized:false,productionAuthorized:false,
   warning:'Structural chain only: no approval of 511+ commits, code reviews, merge conflicts, GitHub rules, deployed apps, secrets or independent launch gates.'
 };
}
export async function fetchOpenPrStack({fetchFn=fetch,token=process.env.GITHUB_TOKEN||process.env.GH_TOKEN||''}={}){
 const all=[];
 for(let page=1;page<=4;page++){
   const url='https://api.github.com/repos/'+REPO+'/pulls?state=open&per_page=100&page='+page;
   const res=await fetchFn(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
     headers:{'Accept':'application/vnd.github+json',
       ...(token?{'Authorization':'Bearer '+token}:{})}
   });
   if(res.status!==200)throw Error('GitHub PR read unavailable; do not infer an empty chain');
   const data=await res.json();
   if(!Array.isArray(data)||data.length>100)throw Error('Invalid GitHub PR response');
   all.push(...data);
   if(data.length<100)return all;
 }
 throw Error('PR read incomplete: pagination limit reached');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv.includes('--read-only-live')){
   console.error('Usage: npm run audit:pr-stack -- --read-only-live [--expected-head <branch>]');
   process.exitCode=2;
 }else{
   try{
     const idx=process.argv.indexOf('--expected-head');
     const expectedLatestBranch=idx<0?null:process.argv[idx+1];
     const pulls=await fetchOpenPrStack();
     const result=analyzeStack(pulls,{expectedLatestBranch});
     console.log(JSON.stringify(result,null,2));
     if(result.status!=='CHAIN_STRUCTURALLY_CONSISTENT_REVIEW_REQUIRED')
       process.exitCode=1;
   }catch{
     console.error('PR stack audit incomplete; GitHub read failed or metadata was invalid.');
     process.exitCode=1;
   }
 }
}
