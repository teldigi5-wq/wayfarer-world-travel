/* Stage 50 release readiness: offline evidence gate, not an authorization to deploy.
   The manual gates never silently turn green from passing unit tests. */
import {readFileSync,statSync,readdirSync} from 'node:fs';
import {PUBLIC_STATIC_FILES,PUBLIC_STATIC_SET} from '../public-static-assets.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const config=JSON.parse(read('vercel.json'));
const html=read('index.html'),pkg=JSON.parse(read('package.json'));
const header=key=>config.headers.find(x=>x.source==='/(.*)')?.headers.find(x=>x.key===key)?.value||'';
const stagedNames=(()=>{try{return readdirSync(new URL('../public/',import.meta.url));}catch{return [];}})();
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
 {id:'vercel-allowlisted-static-output',ok:
    config.outputDirectory==='public'&&
    PUBLIC_STATIC_FILES.length===PUBLIC_STATIC_SET.size&&
    stagedNames.length===PUBLIC_STATIC_FILES.length&&
    stagedNames.every(name=>PUBLIC_STATIC_SET.has(name))&&
    !stagedNames.some(name=>name.endsWith('.mjs')||
      /^(?:vercel\.json|package\.json|server\.mjs|\.env)$/.test(name))&&
    read('scripts/build-airports.mjs').includes('await stagePublicAssets()')&&
    read('.gitignore').includes('public/'),
  evidence:'Vercel static output points to clean generated public/ with only reviewed browser assets; the root API function packaging still requires exact-SHA Preview verification.'},
 {id:'read-only-deployment-inspector',ok:
    pkg.scripts['verify:deployment']==='node scripts/verify-vercel-static.mjs'&&
    pkg.scripts['test:deployment-verifier']==='node --test tests/deployed-http-verification.test.mjs'&&
    read('.github/workflows/checks.yml').includes('npm run test:deployment-verifier')&&
    read('scripts/verify-vercel-static.mjs').includes("method,redirect:'error'")&&
    read('scripts/verify-vercel-static.mjs').includes("if(method==='GET')options.headers={Range:'bytes=0-0'}")&&
    read('scripts/verify-vercel-static.mjs').includes('exactCommitVerified:false')&&
    read('scripts/verify-vercel-static.mjs').includes('serverlessApiVerified:false'),
  evidence:'A read-only opt-in static HTTPS checker and isolated CI fixtures exist; no deployment URL, exact SHA or serverless APIs have been verified.'},
 {id:'serverless-api-rejected-method-gate',ok:
    pkg.scripts['verify:api-routing']==='node scripts/verify-vercel-api-routes.mjs'&&
    pkg.scripts['test:api-method-gates']==='node --test tests/api-method-routing.test.mjs'&&
    read('.github/workflows/checks.yml').includes('npm run test:api-method-gates')&&
    read('scripts/verify-vercel-api-routes.mjs').includes('method:target.probe')&&
    read('scripts/verify-vercel-api-routes.mjs').includes('acceptedApiMethodsVerified:false')&&
    read('api-method-probes.mjs').includes("'/api/airline-offers'")&&
    Object.keys(config.functions).length===8,
  evidence:'All eight Vercel API handlers have CI-tested pre-provider rejected-method checks; future remote probes are opt-in and accepted API functionality remains unverified.'},
 {id:'serverless-api-accepted-input-guards',ok:
    pkg.scripts['test:api-safe-inputs']==='node --test tests/api-safe-input-gates.test.mjs'&&
    read('.github/workflows/checks.yml').includes('npm run test:api-safe-inputs')&&
    read('tests/api-safe-input-gates.test.mjs').includes('All')===false&&
    read('tests/api-safe-input-gates.test.mjs').includes('globalThis.fetch=async()=>')&&
    read('tests/api-safe-input-gates.test.mjs').includes("res.code,expected"),
  evidence:'CI imports all eight real handlers and rejects unauthenticated, malformed and oversized accepted requests without provider calls; real deployed accepted-method flows are still unverified.'},
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
 {id:'deployed-api-function-routing',status:'BLOCKED',reason:'The eight API method guards pass local handler/fixture tests, but an exact-SHA Vercel Preview has not confirmed the deployed routes or real accepted-method behavior.'},
 {id:'deployed-static-artifact-isolation',status:'BLOCKED',reason:'Generated public/ static output passes source checks but actual Vercel function routing and deployed artifact exposure remain unverified; inspect exact-SHA Preview URLs and API endpoints.'},
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
