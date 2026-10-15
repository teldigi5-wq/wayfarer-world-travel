import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {rehearseIntegration} from '../scripts/rehearse-integration.mjs';

const git=(cwd,...args)=>execFileSync('git',args,{
 cwd,encoding:'utf8',timeout:10000,
 env:{...process.env,GIT_CONFIG_NOSYSTEM:'1'}
}).trim();
function fixture(){
 const cwd=mkdtempSync(path.join(tmpdir(),'wayfarer-merge-rehearsal-'));
 git(cwd,'init','-q','-b','main');
 git(cwd,'config','user.name','Rehearsal Fixture');
 git(cwd,'config','user.email','fixture@example.invalid');
 const add=(name,contents,message)=>{
   writeFileSync(path.join(cwd,name),contents);
   git(cwd,'add',name);git(cwd,'commit','-qm',message);
 };
 add('shared.txt','shared original\n','initial baseline');
 return {cwd,add,dispose:()=>rmSync(cwd,{recursive:true,force:true})};
}
test('fast-forward PR tip is only review-eligible, never merge-approved',()=>{
 const f=fixture();
 try{
   const baseline=git(f.cwd,'rev-parse','HEAD');
   git(f.cwd,'checkout','-qb','feature');
   f.add('feature.txt','browser feature\n','add fixture');
   const tip=git(f.cwd,'rev-parse','HEAD');
   const before=git(f.cwd,'status','--porcelain');
   const r=rehearseIntegration({
     cwd:f.cwd,base:baseline,head:'HEAD',
     expectedHead:tip,expectedBase:baseline
   });
   assert.equal(r.status,'FAST_FORWARD_POSSIBLE_REVIEW_REQUIRED');
   assert.equal(r.mainAncestorOfHead,true);
   assert.equal(r.commitsAhead,1);
   assert.equal(r.changedFiles,1);
   assert.equal(r.integrationApproved,false);
   assert.equal(r.productionAuthorized,false);
   assert.equal(git(f.cwd,'rev-parse','HEAD'),tip);
   assert.equal(git(f.cwd,'status','--porcelain'),before);
 }finally{f.dispose()}
});
test('divergent changes can be rehearsed without modifying checked-out branch',()=>{
 const f=fixture();
 try{
   git(f.cwd,'checkout','-qb','feature');
   f.add('feature.txt','feature file\n','feature');
   const tip=git(f.cwd,'rev-parse','HEAD');
   git(f.cwd,'checkout','-q','main');
   f.add('main.txt','new main file\n','main progress');
   const baseline=git(f.cwd,'rev-parse','HEAD');
   const r=rehearseIntegration({cwd:f.cwd,base:baseline,head:tip});
   assert.equal(r.status,'CLEAN_MERGE_REHEARSAL_REVIEW_REQUIRED');
   assert.equal(r.mainAncestorOfHead,false);
   assert.equal(r.commitsAhead,1);
   assert.equal(r.integrationApproved,false);
   assert.equal(git(f.cwd,'branch','--show-current'),'main');
   assert.equal(git(f.cwd,'rev-parse','HEAD'),baseline);
   assert.equal(git(f.cwd,'status','--porcelain'),'');
 }finally{f.dispose()}
});
test('same-line divergent edits are detected as blocked conflicts',()=>{
 const f=fixture();
 try{
   git(f.cwd,'checkout','-qb','feature');
   f.add('shared.txt','feature content\n','feature shared');
   const tip=git(f.cwd,'rev-parse','HEAD');
   git(f.cwd,'checkout','-q','main');
   f.add('shared.txt','main content\n','main shared');
   const base=git(f.cwd,'rev-parse','HEAD');
   const r=rehearseIntegration({cwd:f.cwd,base,head:tip});
   assert.equal(r.status,'BLOCKED');
   assert.equal(r.reason,'conflict-detected');
   assert.equal(git(f.cwd,'branch','--show-current'),'main');
   assert.equal(git(f.cwd,'status','--porcelain'),'');
 }finally{f.dispose()}
});
test('SHA drift, missing refs and invalid command injection are blocked',()=>{
 const f=fixture();
 try{
   const sha=git(f.cwd,'rev-parse','HEAD');
   const invalid=[
     {base:sha,head:'HEAD',expectedHead:'a'.repeat(40)},
     {base:sha,head:'HEAD',expectedBase:'b'.repeat(40)},
     {base:'--upload-pack=evil',head:'HEAD'},
     {base:sha,head:'HEAD; rm -rf /'},
     {base:'c'.repeat(40),head:sha},
     {base:sha,head:'d'.repeat(40)}
   ];
   for(const args of invalid){
     const r=rehearseIntegration({cwd:f.cwd,...args});
     assert.equal(r.status,'BLOCKED',JSON.stringify(args));
     assert.equal(r.integrationApproved,false);
   }
 }finally{f.dispose()}
});
test('entirely unrelated Git histories cannot claim integration feasibility',()=>{
 const f=fixture();
 try{
   const baseline=git(f.cwd,'rev-parse','HEAD');
   git(f.cwd,'checkout','--orphan','unrelated');
   git(f.cwd,'rm','-q','-rf','.');
   f.add('unrelated.txt','another root\n','orphan root');
   const r=rehearseIntegration({cwd:f.cwd,base:baseline,head:'HEAD'});
   assert.equal(r.status,'BLOCKED');
   assert.equal(r.reason,'unrelated-histories-or-incomplete-checkout');
 }finally{f.dispose()}
});
