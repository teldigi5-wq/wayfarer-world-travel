import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,existsSync,statSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const script=new URL('../scripts/release-readiness.mjs',import.meta.url).pathname;
const parsed=()=>JSON.parse(execFileSync(process.execPath,[script,'--json'],{encoding:'utf8'}));

test('release gate reports NO-GO while owner, browser, legal and security evidence is missing',()=>{
 const report=parsed();
 assert.equal(report.stage,50);
 assert.equal(report.releaseDecision,'NO_GO');
 assert.equal(report.productionAuthorization,false);
 assert.equal(report.automatic.passed,report.automatic.total,
   'Version-controlled release checks must be green; manual gates stay separately blocked');
 const blocked=report.manualGates.filter(x=>x.status==='BLOCKED').map(x=>x.id);
 for(const required of [
  'stacked-review-and-merge-plan','exact-sha-preview-browser-qa',
  'history-secrets-and-environment','privacy-terms-and-operator-identity',
  'production-performance-and-accessibility','owner-launch-approval'
 ])assert.ok(blocked.includes(required),'Missing genuine release blocker: '+required);
 assert.ok(report.manualGates.some(x=>x.id==='billable-provider-abuse-guard'&&
   x.status==='BLOCKED_FOR_PAID_FEATURES'));
});
test('release require-go command fails closed without privileged or external calls',()=>{
 const result=spawnSync(process.execPath,[script,'--require-go'],{encoding:'utf8'});
 assert.equal(result.status,2);
 assert.match(result.stdout,/RELEASE GATE: NO_GO/);
 assert.match(result.stdout,/No merge, deployment, billing change or paid search authorized/);
});
test('branded favicon, OG image, canonical, description and semantic title use real deploy assets',()=>{
 const html=read('index.html');
 assert.match(html,/<title>Wayfarer — Travel, composed around you<\/title>/);
 assert.match(html,/<meta name="description" content="Wayfarer/);
 assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/favicon.svg"/);
 assert.match(html,/<link rel="canonical" href="https:\/\/wayfarer-world-travel\.vercel\.app\/"/);
 assert.match(html,/<meta property="og:image" content="https:\/\/wayfarer-world-travel\.vercel\.app\/wayfarer-hero-v3\.jpg"/);
 assert.match(html,/<meta property="og:description" content="[^"]*No guaranteed flight or hotel inventory/);
 assert.match(html,/<meta name="twitter:card" content="summary_large_image"/);
 for(const path of ['favicon.svg','wayfarer-hero-v3.jpg']){
   assert.ok(existsSync(new URL('../'+path,import.meta.url)));
   assert.ok(statSync(new URL('../'+path,import.meta.url)).size>120,'Empty brand asset '+path);
 }
 const svg=read('favicon.svg');
 assert.match(svg,/<svg[^>]+viewBox="0 0 64 64"/);
 assert.doesNotMatch(svg,/script|onload=|foreignObject/i,'No executable SVG in favicon');
});
test('CI checks actual offline build plus immutable data and reports blockers without pretending it is launch approval',()=>{
 const workflow=read('.github/workflows/checks.yml');
 assert.match(workflow,/npm run build/);
 assert.match(workflow,/git diff --exit-code -- airports-index\.json/);
 assert.match(workflow,/npm run release:report/);
 assert.doesNotMatch(workflow,/vercel deploy|vercel --prod|gh pr merge|curl .*api\.groq/);
 const packageJson=JSON.parse(read('package.json'));
 assert.equal(packageJson.scripts.build,'node scripts/build-airports.mjs');
 assert.equal(packageJson.scripts['release:report'],'node scripts/release-readiness.mjs');
 assert.match(packageJson.scripts.check,/node --check scripts\/release-readiness\.mjs/);
 const offline=read('scripts/build-airports.mjs');
 assert.doesNotMatch(offline,/\bfetch\s*\(|\bexecFile\s*\(|\bhttps\.request\s*\(/);
 assert.match(offline,/checked-in airport references/);
 const refresh=read('.github/workflows/daily-airports.yml');
 assert.match(refresh,/scripts\/refresh-airports\.mjs/);
 assert.match(refresh,/Open review-only update PR/);
});
