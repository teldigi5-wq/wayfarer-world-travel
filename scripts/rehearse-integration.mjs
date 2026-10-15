/* Stage 64: locally rehearse an integration tip against the fetched main tree.
 * No GitHub write operations, merge commits, rebases, ref updates, deployments,
 * browser requests, secrets or paid services. git merge-tree --write-tree
 * may create unreachable temporary *local Git objects*, but never updates
 * an index, branch ref, user worktree or remote repository.
 */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const allowedRef=value=>typeof value==='string'&&(
  value==='HEAD'||value==='refs/remotes/origin/main'||/^[a-f0-9]{40}$/.test(value)
);
function git(cwd,args){
 const result=spawnSync('git',args,{
   cwd,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}
 });
 return {status:result.status,error:!!result.error,
   stdout:result.stdout??'',stderr:result.stderr??''};
}
const blocked=(reason,baseSha=null,headSha=null)=>({
  status:'BLOCKED',reason,baseSha,headSha,
  integrationApproved:false,productionAuthorized:false
});
function commit(cwd,ref){
 const result=git(cwd,['rev-parse','--verify',ref+'^{commit}']);
 const sha=result.stdout.trim();
 return result.status===0&&/^[a-f0-9]{40}$/.test(sha)?sha:null;
}
export function rehearseIntegration({
  cwd=process.cwd(),base='refs/remotes/origin/main',
  head='HEAD',expectedHead=null,expectedBase=null
}={}){
 if(!allowedRef(base)||!allowedRef(head)||
   (expectedHead!==null&&!/^[a-f0-9]{40}$/.test(expectedHead))||
   (expectedBase!==null&&!/^[a-f0-9]{40}$/.test(expectedBase)))
   return blocked('invalid-ref');
 const baseSha=commit(cwd,base),headSha=commit(cwd,head);
 if(!baseSha||!headSha)return blocked('required-commit-unavailable',baseSha,headSha);
 if(expectedHead&&expectedHead!==headSha)
   return blocked('tip-sha-drift',baseSha,headSha);
 if(expectedBase&&expectedBase!==baseSha)
   return blocked('main-sha-drift',baseSha,headSha);
 const ancestor=git(cwd,['merge-base','--is-ancestor',baseSha,headSha]);
 const common=git(cwd,['merge-base',baseSha,headSha]);
 if(common.status!==0||!/^[a-f0-9]{40}$/.test(common.stdout.trim()))
   return blocked('unrelated-histories-or-incomplete-checkout',baseSha,headSha);
 if(ancestor.status!==0&&ancestor.status!==1)
   return blocked('ancestry-check-failed',baseSha,headSha);
 const commits=git(cwd,['rev-list','--count',baseSha+'..'+headSha]);
 const diff=git(cwd,['diff','--name-only',baseSha+'...'+headSha]);
 if(commits.status!==0||diff.status!==0)
   return blocked('diff-inspection-failed',baseSha,headSha);
 const ahead=Number(commits.stdout.trim());
 if(!Number.isSafeInteger(ahead)||ahead<0)
   return blocked('invalid-commit-count',baseSha,headSha);
 const changedFiles=diff.stdout.split('\n').filter(Boolean).length;
 let kind;
 if(ancestor.status===0){
   kind='FAST_FORWARD_POSSIBLE_REVIEW_REQUIRED';
 }else{
   const merge=git(cwd,['merge-tree','--write-tree','--messages',baseSha,headSha]);
   if(merge.error||merge.status===null||merge.status>1)
     return blocked('local-merge-rehearsal-unavailable',baseSha,headSha);
   if(merge.status===1)return blocked('conflict-detected',baseSha,headSha);
   kind='CLEAN_MERGE_REHEARSAL_REVIEW_REQUIRED';
 }
 return {
   status:kind,baseSha,headSha,commitsAhead:ahead,changedFiles,
   mainAncestorOfHead:ancestor.status===0,
   largeUnreviewedStack:ahead>=100||changedFiles>=50,
   integrationApproved:false,productionAuthorized:false,
   warning:'Git object-level integration feasibility only. Every stacked PR requires review, CI, protected-branch approvals and deployed-artifact verification.'
 };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const value=(key,defaultValue)=>{const i=args.indexOf(key);return i<0?defaultValue:args[i+1]};
 const res=rehearseIntegration({
   base:value('--base','refs/remotes/origin/main'),
   head:value('--head','HEAD'),
   expectedHead:value('--expected-head',null),
   expectedBase:value('--expected-main',null)
 });
 process.stdout.write(JSON.stringify(res,null,2)+'\n');
 if(!res.status.endsWith('_REVIEW_REQUIRED'))process.exitCode=1;
}
