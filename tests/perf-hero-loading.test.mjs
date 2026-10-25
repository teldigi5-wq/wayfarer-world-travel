import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../art-direction.css',import.meta.url),'utf8');

test('first-view hero has a single, consistent high-priority local image',()=>{
  assert.match(html,/<link rel="preload" as="image" href="wayfarer-hero-v3\.jpg" fetchpriority="high">/);
  assert.match(html,/<img class="hero-media" src="wayfarer-hero-v3\.jpg" fetchpriority="high" decoding="async"/);
  assert.doesNotMatch(html,/<img class="hero-media"[^>]*loading="lazy"/);
  assert.ok(html.indexOf('rel="preload"') < html.indexOf('rel="stylesheet"'));
  assert.equal((html.match(/wayfarer-hero-v3\.jpg/g)||[]).length,2);
});

test('original cinematic motion and reduced-motion support stay intact',()=>{
  assert.match(css, /#discover \.hero-media\{[^}]*animation:heroCinema/);
  assert.match(css,/#discover \.hero-copy>\*\{animation:wfRise/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /\/\* Mobile hero performance:/);
});
