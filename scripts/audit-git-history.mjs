/* Reachable textual Git-history credential pattern scan.
 * No network, paid tooling, fetched provider keys, or credential values in output.
 * Covers added diff lines in all locally fetched refs. Does not inspect unreachable
 * orphan commits, binaries, private external repositories, or arbitrary unknown
 * token formats. Findings require manual rotation/triage.
 */
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';

const PATTERNS=[
  ['github_classic',/\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['github_fine_grained',/\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['aws_access_id',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['google_api_key',/\bAIza[0-9A-Za-z_-]{35}\b/],
  ['groq_api_key',/\bgsk_[A-Za-z0-9]{40,}\b/],
  ['openai_api_key',/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{38,}\b/],
  ['stripe_live_secret',/\bsk_live_[A-Za-z0-9]{24,}\b/],
  ['slack_token',/\bxox[baprs]-[A-Za-z0-9-]{25,}\b/],
  ['gitlab_token',/\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['private_key_pem',/-----BEGIN (?:(?:RSA|EC|DSA|OPENSSH|PGP) )?PRIVATE KEY(?: BLOCK)?-----/]
];
const ASSIGNMENT=/\b(?:SERPAPI_API_KEY|GROQ_API_KEY|DUFFEL_ACCESS_TOKEN|N8N_WEBHOOK_AUTH|WAYFARER_AI_BETA_TOKEN|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]([A-Za-z0-9_/+=.-]{28,})['"]/;
const BLOCK_WORDS=/placeholder|example|not[_-]?real|test[_-]?only|dummy|fixture|fake|change[_-]?me|your[_-]?(?:api|secret|key)/i;
function likelyLiteralSecret(text){
  const matched=ASSIGNMENT.exec(text);
  if(!matched||BLOCK_WORDS.test(matched[1]))return false;
  const s=matched[1],counts=new Map();
  for(const char of s)counts.set(char,(counts.get(char)||0)+1);
  const bits=[...counts.values()].reduce((sum,n)=>{
    const p=n/s.length;return sum-p*Math.log2(p);
  },0);
  return bits>=3.7;
}
export function classifyAddedLine(line){
  if(typeof line!=='string'||!line.startsWith('+')||line.startsWith('+++'))return [];
  const text=line.slice(1);
  const results=PATTERNS.filter(([,re])=>re.test(text)).map(([name])=>name);
  if(likelyLiteralSecret(text))results.push('high_entropy_provider_literal');
  return results;
}
const safeFile=file=>/^[A-Za-z0-9_./ -]{1,180}$/.test(file)?file:'(path withheld)';
export async function scanHistory({cwd=process.cwd()}={}){
  // This audit intentionally rejects shallow copies rather than falsely
  // advertising a complete local reachable-history scan.
  let isShallow;
  try{
    isShallow=execFileSync('git',['rev-parse','--is-shallow-repository'],{
      cwd,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000
    }).trim();
  }catch{return {error:'not_git_checkout',commits:0,findings:[]};}
  if(isShallow!=='false')return {error:'shallow_checkout',commits:0,findings:[]};
  const child=spawn('git',['log','--all','-p','-U0','--no-ext-diff','--no-textconv',
    '--format=WAYFARER_AUDIT_COMMIT:%H','--'],{
    cwd,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_PAGER:'cat'}
  });
  const exitPromise=new Promise(resolve=>{
    child.once('error',()=>resolve(1));
    child.once('close',code=>resolve(code??1));
  });
  let commit='',file='',commits=0,addedLines=0;
  const findings=[],seen=new Set();
  // Never include stderr: it may contain unexpected private source text.
  child.stderr.resume();
  const stream=createInterface({input:child.stdout,crlfDelay:Infinity});
  for await (const line of stream){
    if(line.startsWith('WAYFARER_AUDIT_COMMIT:')){
      commit=line.slice('WAYFARER_AUDIT_COMMIT:'.length).trim();
      if(/^[a-f0-9]{40}$/.test(commit))commits++;
      else commit='';
      file='';
      continue;
    }
    if(line.startsWith('+++ b/')){file=line.slice(6).split('\t')[0];continue;}
    if(line.startsWith('diff --git')){file='';continue;}
    if(!line.startsWith('+')||line.startsWith('+++'))continue;
    addedLines++;
    for(const category of classifyAddedLine(line)){
      const key=[category,commit,file].join(':');
      if(seen.has(key))continue;
      seen.add(key);
      findings.push({category,commit:commit.slice(0,12),path:safeFile(file)});
    }
  }
  const exit=await exitPromise;
  if(exit!==0||commits<1)return {error:'history_scan_incomplete',commits,addedLines,findings:[]};
  return {error:null,commits,addedLines,findings};
}
const runAsCli=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(runAsCli){
  const result=await scanHistory();
  // Never print matched credential contents, diffs, commands or Git stderr.
  console.log('Reachable Git-history credential-pattern audit');
  console.log('Commits:',result.commits,'Added text lines:',result.addedLines,
    'High-confidence candidate locations:',result.findings.length);
  for(const hit of result.findings.slice(0,30))
    console.log('POTENTIAL_SECRET',hit.category,hit.commit,hit.path);
  if(result.findings.length>30)
    console.log('Additional candidate locations withheld:',result.findings.length-30);
  if(result.error){
    console.error('AUDIT_INCOMPLETE:',result.error);
    process.exitCode=1;
  }else if(result.findings.length){
    console.error('BLOCKED: review and rotate potentially committed credentials; do not print matches or rewrite Git history automatically.');
    process.exitCode=2;
  }else{
    console.log('PASS: no high-confidence patterns in reachable added text lines. This is NOT comprehensive secret clearance.');
  }
}
