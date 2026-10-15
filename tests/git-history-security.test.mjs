import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {classifyAddedLine,scanHistory} from '../scripts/audit-git-history.mjs';

const script=fileURLToPath(new URL('../scripts/audit-git-history.mjs',import.meta.url));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}).trim();
function repository(){
 const cwd=mkdtempSync(join(tmpdir(),'wayfarer-history-audit-'));
 git(cwd,'init','-q');
 git(cwd,'config','user.email','security-test@example.invalid');
 git(cwd,'config','user.name','Wayfarer Security Fixture');
 return {cwd,commit(name,content){
   mkdirSync(join(cwd,dirname(name)),{recursive:true});
   writeFileSync(join(cwd,name),content);
   git(cwd,'add',name);
   git(cwd,'commit','-qm','fixture commit');
 },clean(){rmSync(cwd,{recursive:true,force:true});}};
}
test('scanner recognizes high-confidence secret patterns only on added diff lines',()=>{
 const simulated='ghp_'+'A'.repeat(36);
 assert.deepEqual(classifyAddedLine('+export const token="'+simulated+'";'),['github_classic']);
 assert.deepEqual(classifyAddedLine('-export const token="'+simulated+'";'),[]);
 assert.deepEqual(classifyAddedLine('+++ b/token'),[]);
 assert.deepEqual(classifyAddedLine('+const README="replace-your-key";'),[]);
 assert.deepEqual(classifyAddedLine('+process.env.GROQ_API_KEY'),[]);
 assert.deepEqual(classifyAddedLine('+SERPAPI_API_KEY="fixture-not-a-real-provider-key-12345"'),[]);
 assert.deepEqual(classifyAddedLine('+-----BEGIN '+'PRIVATE KEY-----'),['private_key_pem']);
});
test('reachable history detects a deleted credential in an earlier commit, with redacted report',async()=>{
 const f=repository();
 const fake='ghp_'+'B'.repeat(36);
 try{
   f.commit('config.txt','token='+fake+'\n');
   f.commit('config.txt','token removed from latest commit\n');
   const audit=await scanHistory({cwd:f.cwd});
   assert.equal(audit.error,null);
   assert.equal(audit.commits,2);
   assert.equal(audit.findings.length,1);
   assert.equal(audit.findings[0].category,'github_classic');
   assert.equal(audit.findings[0].path,'config.txt');
   assert.equal(audit.findings[0].commit.length,12);
   assert.doesNotMatch(JSON.stringify(audit),new RegExp(fake));
   const report=spawnSync(process.execPath,[script],{cwd:f.cwd,encoding:'utf8',timeout:30000});
   assert.equal(report.status,2,'Any high-confidence credential should fail the audit');
   assert.match(report.stdout,/POTENTIAL_SECRET github_classic/);
   assert.doesNotMatch(report.stdout+report.stderr,new RegExp(fake));
 }finally{f.clean();}
});
test('high-entropy fixture assignments remain visible for manual review; the same assignment in app source is blocking',async()=>{
 const f=repository();
 const synthetic=['p9Ab','C8dE','f7Gh','I6jK','l5Mn','O4pQ','r3St','U2vW','x1Yz'].join('');
 try{
   f.commit('tests/sample.test.mjs','SERPAPI_API_KEY="'+synthetic+'"\\n');
   const first=await scanHistory({cwd:f.cwd});
   assert.equal(first.error,null);
   assert.equal(first.findings.length,1);
   assert.equal(first.findings[0].category,'high_entropy_provider_literal');
   assert.equal(first.findings[0].severity,'manual_review');
   const review=spawnSync(process.execPath,[script],{cwd:f.cwd,encoding:'utf8',timeout:30000});
   assert.equal(review.status,0,'Test fixtures do not masquerade as confirmed credential incidents');
   assert.match(review.stdout,/REVIEW_TEST_FIXTURE high_entropy_provider_literal/);
   assert.doesNotMatch(review.stdout+review.stderr,new RegExp(synthetic));
   f.commit('src/config.mjs','SERPAPI_API_KEY="'+synthetic+'"\\n');
   const second=await scanHistory({cwd:f.cwd});
   assert.ok(second.findings.some(x=>x.severity==='blocking'&&x.path==='src/config.mjs'));
   assert.ok(second.findings.some(x=>x.severity==='manual_review'&&x.path==='tests/sample.test.mjs'));
   const denied=spawnSync(process.execPath,[script],{cwd:f.cwd,encoding:'utf8',timeout:30000});
   assert.equal(denied.status,2);
   assert.match(denied.stdout,/POTENTIAL_SECRET high_entropy_provider_literal/);
   assert.doesNotMatch(denied.stdout+denied.stderr,new RegExp(synthetic));
 }finally{f.clean();}
});
test('clean history passes and empty checkout cannot masquerade as inspected',async()=>{
 const f=repository();
 try{
   assert.equal((await scanHistory({cwd:f.cwd})).error,'history_scan_incomplete');
   f.commit('README.md','# Source-led travels\nNo credentials stored here.\n');
   const audit=await scanHistory({cwd:f.cwd});
   assert.equal(audit.error,null);
   assert.equal(audit.commits,1);
   assert.equal(audit.findings.length,0);
   const report=spawnSync(process.execPath,[script],{cwd:f.cwd,encoding:'utf8',timeout:30000});
   assert.equal(report.status,0);
   assert.match(report.stdout,/NOT comprehensive secret clearance/);
 }finally{f.clean();}
});
test('shallow checkouts are explicitly rejected rather than described as full history',async()=>{
 const src=repository(),dst=mkdtempSync(join(tmpdir(),'wayfarer-shallow-scan-'));
 try{
   src.commit('a.txt','first commit\n');
   src.commit('a.txt','second commit\n');
   git(dst,'clone','-q','--depth','1','--no-local','file://'+src.cwd,'.');
   assert.equal(git(dst,'rev-parse','--is-shallow-repository'),'true');
   const audit=await scanHistory({cwd:dst});
   assert.equal(audit.error,'shallow_checkout');
   assert.equal(audit.commits,0);
 }finally{src.clean();rmSync(dst,{recursive:true,force:true});}
});
test('history scan classifies sensitive metadata without depending on network or external scanning services',()=>{
 const source=execFileSync(process.execPath,['--check',script],{encoding:'utf8'});
 assert.equal(source,'');
});
