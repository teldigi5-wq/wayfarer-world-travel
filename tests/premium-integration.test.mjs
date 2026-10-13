import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const conf=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('one premium home and no legacy script/style collisions',()=>{
  assert.match(html,/Go somewhere/);assert.match(html,/premium-base\.css/);assert.match(html,/premium-app\.js/);
  for(const legacy of ['app.mjs','motion.mjs','styles.css','travel-offers-panel.mjs'])assert.doesNotMatch(html,new RegExp('(?:src|href)=[\"\']'+legacy));
  assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>/);assert.doesNotMatch(html,/<style>/);
});
test('strict CSP without unsafe inline, and both API surfaces configured',()=>{
  const csp=conf.headers[0].headers.find(v=>v.key==='Content-Security-Policy')?.value;
  assert.match(csp,/script-src 'self'/);assert.match(csp,/connect-src 'self'/);
  assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);
  assert.ok(conf.functions['api/travel-search.js']);assert.ok(conf.functions['api/ai-plan.mjs']);
});
