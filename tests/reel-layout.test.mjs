import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../experience-layer.css', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../premium-app.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('destination reel images fill their cards instead of beginning halfway down', () => {
  const rule = css.match(/#reel\s*>\s*\.destination\s*>\s*img\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'missing image layout override');
  for (const declaration of ['position:absolute', 'inset:0', 'top:0', 'left:0',
    'width:100%', 'height:100%', 'object-fit:cover', 'object-position:center center']) {
    assert.ok(rule.includes(declaration), 'missing full-bleed declaration: ' + declaration);
  }
  const parent = css.match(/#reel\s*>\s*\.destination\s*\{([^}]+)\}/)?.[1];
  assert.match(parent || '', /overflow:hidden/);
  assert.match(parent || '', /position:relative/);
  assert.match(markup, /class="destination reveal"[^>]*>[\s\S]*?<img loading="lazy"/);
});

test('destination overlays sit above photos without blocking card interaction', () => {
  const overlay = css.match(/#reel\s*>\s*\.destination::after\s*\{([^}]+)\}/)?.[1] || '';
  const labels = css.match(/#reel\s*>\s*\.destination\s+\.dest-copy\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(overlay, /pointer-events:none/);
  assert.match(overlay, /z-index:1/);
  assert.match(labels, /z-index:2/);
});

test('mobile cards remain scrollable and keyboard focus remains visible', () => {
  assert.match(css, /@media\s*\(max-width:650px\)/);
  assert.match(css, /flex:0 0 84vw/);
  assert.match(css, /#reel\s*>\s*\.destination:focus-visible/);
  assert.match(css, /scroll-padding-top:110px/);
  assert.match(page, /id="reel"/);
});

test('new reel rules preserve existing strict CSP and no duplicate legacy frontend', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const policy = config.headers.flatMap(h => h.headers || [])
    .find(h => h.key === 'Content-Security-Policy')?.value;
  assert.match(policy || '', /script-src 'self'/);
  assert.doesNotMatch(policy || '', /unsafe-inline|unsafe-eval/);
  assert.ok(page.includes('premium-base.css'));
  assert.ok(!page.includes('src="app.mjs"'));
});
