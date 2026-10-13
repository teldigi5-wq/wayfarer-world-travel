import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=readFileSync(new URL('../legibility-system.css',import.meta.url),'utf8');
const arrival=readFileSync(new URL('../arrival-journeys.css',import.meta.url),'utf8');

function luminance(hex) {
  const channels = hex.match(/\w\w/g)?.map(n=>parseInt(n,16)/255).map(v=>
    v<=0.04045 ? v/12.92 : Math.pow((v+.055)/1.055,2.4));
  assert.equal(channels?.length,3);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
function contrast(a,b) {
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+.05)/(lo+.05);
}
test('professional foregrounds exceed WCAG AA normal-text contrast against actual panel surfaces',()=>{
  for (const background of ['12362d','194237']) {
    for (const foreground of ['faf6eb','e8f0e7','c4d5ca','e8c992']) {
      assert.ok(contrast(background,foreground)>=4.5,
        '#'+foreground+' on #'+background+' has insufficient contrast');
    }
  }
  assert.ok(contrast('e8c992','08221d')>=4.5,'primary call-to-action contrast');
});
test('new legibility style is loaded last and overrides low-contrast Arrival surfaces',()=>{
  assert.match(page, /<link rel="stylesheet" href="arrival-journeys.css"><link rel="stylesheet" href="legibility-system.css">/);
  assert.match(styles, /#arrival \.wf-readiness-panel/);
  assert.match(styles, /#arrival \.wf-intelligence-panel/);
  assert.match(styles, /#arrival \.wf-arrival-intel>div/);
  assert.match(styles, /#arrival \.wf-context-note/);
  assert.match(styles, /#arrival \.check small/);
  assert.match(styles, /#trips \.wf-journey-grid \.trip/);
  assert.match(styles, /#trips #journey-search/);
  assert.match(styles, /background:var\(--wf-ui-card\)/);
  assert.match(styles, /color:var\(--wf-ui-secondary\)/);
  assert.match(arrival, /#arrival \.wf-readiness-panel/);
});
test('practical interface is readable and keyboard/mobile friendly',()=>{
  assert.match(styles, /#arrival \.check\{[\s\S]*?min-height:70px/);
  assert.match(styles, /#arrival \.check small\{[\s\S]*?font-size:\.91rem/);
  assert.match(styles, /#arrival a:focus-visible/);
  assert.match(styles, /#trips #journey-search:focus-visible/);
  assert.match(styles, /@media\(max-width:650px\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});
