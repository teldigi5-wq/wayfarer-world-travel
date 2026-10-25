import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const base=readFileSync(new URL('../premium-base.css',import.meta.url),'utf8');
const motion=readFileSync(new URL('../premium-motion.css',import.meta.url),'utf8');
const art=readFileSync(new URL('../art-direction.css',import.meta.url),'utf8');

const light=hex=>hex.match(/[0-9a-f]{2}/gi).map(channel=>{
  const n=parseInt(channel,16)/255;
  return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
}).reduce((sum,v,i)=>sum+[.2126,.7152,.0722][i]*v,0);
const contrast=(a,b)=>{
  const x=light(a),y=light(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

test('dark footer navigation has sufficient text contrast and accessible keyboard focus',()=>{
  const match=base.match(/\.footer a\{[^}]*color:(#[0-9a-f]{6})/i);
  assert.ok(match,'Footer links need an explicit foreground color');
  assert.ok(contrast(match[1],'#05130f')>=4.5,'Footer links must meet WCAG AA contrast');
  assert.match(base,/\.footer a:focus-visible\{outline:2px solid/);
  for(const label of ['Discover','Journey Studio','Arrival Companion']){
    assert.ok(html.includes('>'+label+'</a>'),label);
  }
});

test('hero editorial card follows the page h1 as h2 and retains all existing styles',()=>{
  assert.ok(html.includes('<h2>Alpine lakes, Switzerland</h2>'));
  assert.ok(!html.includes('<h3>Alpine lakes, Switzerland</h3>'));
  assert.match(html,/<h1 class="display">/);
  for(const css of [base,motion,art]){
    assert.ok(css.includes('.hero-card h2'),'Missing hero card selector');
    assert.ok(!css.includes('.hero-card h3'),'Stale card selector');
  }
});
