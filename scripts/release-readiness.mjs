/* Stage 50 release readiness: offline evidence gate, not an authorization to deploy.
   The manual gates never silently turn green from passing unit tests. */
import {readFileSync,statSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const config=JSON.parse(read('vercel.json'));
const html=read('index.html'),pkg=JSON.parse(read('package.json'));
const header=key=>config.headers.find(x=>x.source==='/(.*)')?.headers.find(x=>x.key===key)?.value||'';
const checks=[
 {id:'offline-build',ok:!/(?:fetch\s*\(|execFile\s*\(|https\.request\s*\()/.test(read('scripts/build-airports.mjs')),
  evidence:'The Vercel build only reads the checked-in airport reference; the daily refresh remains separately reviewed.'},
 {id:'static-brand-assets',ok:['favicon.svg','wayfarer-hero-v3.jpg'].every(f=>{
   try{return statSync(new URL('../'+f,import.meta.url)).size>0;}catch{return false;}
 }),evidence:'Nonempty original favicon and photography referenced by the home page.'},
 {id:'canonical-and-social',ok:html.includes('rel="canonical" href="https://wayfarer-world-travel.vercel.app/"')&&
    html.includes('href="favicon.svg"')&&html.includes('property="og:image"')&&
    html.includes('name="twitter:card"'),
  evidence:'Homepage has canonical, social preview and icon metadata.'},
 {id:'baseline-security-headers',ok:header('Strict-Transport-Security')==='max-age=31536000'&&
    header('X-Frame-Options')==='DENY'&&header('Cross-Origin-Opener-Policy')==='same-origin'&&
    /script-src 'self'/.test(header('Content-Security-Policy'))&&
    /connect-src 'self'/.test(header('Content-Security-Policy'))&&
    !/unsafe-inline|unsafe-eval/.test(header('Content-Security-Policy')),
  evidence:'Version-controlled Vercel headers; live browser enforcement remains unverified.'},
 {id:'beta-browser-data-transparency',ok:
    ['data-and-privacy.html','browser-data.js','browser-data.css'].every(path=>{
      try{return statSync(new URL('../'+path,import.meta.url)).size>0;}catch{return false;}
    })&&html.includes('href="data-and-privacy.html"')&&
    read('data-and-privacy.html').includes('Beta information, not finalized legal terms')&&
    read('browser-data.js').includes("'wf-trips-v2'")&&
    read('browser-data.js').includes("'wf-checks-v2'")&&
    !/localStorage\.clear\(/.test(read('browser-data.js')),
  evidence:'An accessible beta disclosure and narrowly scoped two-step local deletion are present; formal legal notices remain a separate blocker.'},
 {id:'production-metered-provider-lock',ok:
    ['api/ai-plan.mjs','api/intelligence.js','api/travel-offers.mjs',
      'api/travel-search.js','api/flight-selection.mjs','api/airline-offers.mjs']
      .every(path=>read(path).includes('meteredProviderLocked()'))&&
    read('provider-production-lock.mjs').includes("VERCEL_ENV==='production'")&&
    read('provider-production-lock.mjs').includes("VERCEL_TARGET_ENV==='production'"),
  evidence:'All six optional metered AI/travel paths include the shared fail-closed public Production gate; this is not a distributed spending quota.'},
 {id:'local-http-asset-isolation',ok:
    read('server.mjs').includes('PUBLIC_STATIC_SET.has(file)')&&
    read('server.mjs').includes('createStaticServer')&&
    read('public-static-assets.mjs').includes('PUBLIC_STATIC_FILES')&&
    pkg.scripts['smoke:local']==='node --test tests/local-preview-http.test.mjs'&&
    read('.github/workflows/checks.yml').includes('npm run smoke:local'),
  evidence:'The local HTTP server uses an explicit client-asset allowlist and CI exercises real GET/HEAD/404 behavior; deployed Vercel output still requires inspection.'},
 {id:'no-billable-build-step',ok:pkg.scripts.build==='node scripts/build-airports.mjs'&&
    !/serpapi|groq|duffel|n8n/i.test(pkg.scripts.build),
  evidence:'Build command cannot initiate private paid-provider search.'},
 {id:'public-data-not-live-booking',ok:/not verified|not proof/i.test(
    JSON.parse(read('airports-index.json')).usage||'')&&
    /private beta|private-beta|beta/i.test(read('README.md')),
  evidence:'Airport reference data and private-beta scopes must not be misrepresented as live ticket inventory.'}
];
const manual=[
 {id:'stacked-review-and-merge-plan',status:'BLOCKED',reason:'Draft PR chain including #8 and #41–#49 has not been independently reviewed or approved for integration.'},
 {id:'exact-sha-preview-browser-qa',status:'BLOCKED',reason:'No exact-commit candidate Vercel Preview or real mobile/desktop browser validation.'},
 {id:'deployed-static-artifact-isolation',status:'BLOCKED',reason:'Local HTTP allowlist has not been proven to govern Vercel deployment assets; inspect actual deployed URLs for server code, private metadata and tests.'},
 {id:'history-secrets-and-environment',status:'BLOCKED',reason:'Full Git-history secret scan, Vercel environment scoping, and provider-console permissions not independently verified.'},
 {id:'privacy-terms-and-operator-identity',status:'BLOCKED',reason:'Public privacy notice, acceptable terms, legitimate contact/operator identity and legal review have not been approved.'},
 {id:'production-performance-and-accessibility',status:'BLOCKED',reason:'Real-browser keyboard, screen reader, low-end device and load/performance audits are not complete.'},
 {id:'billable-provider-abuse-guard',status:'BLOCKED_FOR_PAID_FEATURES',reason:'Durable distributed identity-bound limits and provider spend ceilings unverified; paid features must remain disabled.'},
 {id:'owner-launch-approval',status:'BLOCKED',reason:'Owner has not authorized merging stacked PRs or deployment to Production.'}
];
const codeReady=checks.every(x=>x.ok);
const blockers=manual.filter(x=>x.status==='BLOCKED').length;
const state=codeReady&&blockers===0?'REVIEW_CANDIDATE':'NO_GO';
const report={stage:50,releaseDecision:state,
  automatic:{passed:checks.filter(x=>x.ok).length,total:checks.length,checks},
  manualGates:manual,productionAuthorization:false,
  disclaimer:'Offline static assessment only; not a pentest, live-browser QA, provider availability claim or deployment authorization.'};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else{
 process.stdout.write('WAYFARER · STAGE 50 RELEASE GATE: '+state+'\n');
 process.stdout.write('Version-controlled checks: '+report.automatic.passed+'/'+report.automatic.total+' passed.\n');
 for(const item of checks)process.stdout.write((item.ok?'PASS ':'FAIL ')+item.id+' — '+item.evidence+'\n');
 for(const item of manual)process.stdout.write(item.status+' '+item.id+' — '+item.reason+'\n');
 process.stdout.write('No merge, deployment, billing change or paid search authorized.\n');
}
if(process.argv.includes('--require-go')&&state!=='REVIEW_CANDIDATE')process.exitCode=2;
