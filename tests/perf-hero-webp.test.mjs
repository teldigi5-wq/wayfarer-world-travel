import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const image=readFileSync(new URL('../wayfarer-hero-v3.webp',import.meta.url));
const jpg=statSync(new URL('../wayfarer-hero-v3.jpg',import.meta.url)).size;
const css=readFileSync(new URL('../art-direction.css',import.meta.url),'utf8');

test('Hero photograph is a real compressed WebP, keeping the exact JPG fallback',()=>{
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
  assert.ok(image.length<jpg*0.8,'WebP must save at least 20% of hero bytes');
  assert.match(markup,/<picture class="hero-artwork"><source type="image\/webp" srcset="wayfarer-hero-v3\.webp"><img class="hero-media" src="wayfarer-hero-v3\.jpg"/);
  assert.match(markup,/<link rel="preload" as="image" type="image\/webp" href="wayfarer-hero-v3\.webp" fetchpriority="high">/);
  assert.match(markup,/class="hero-media"[^>]*fetchpriority="high"[^>]*alt="Traveler overlooking a mountain lake and historic village at blue hour"/);
});

test('Hero positioning and original motion and accessibility preferences stay intact',()=>{
  assert.match(css,/#discover \.hero-media\{[^}]*position:absolute/);
  assert.match(css,/#discover \.hero-media\{[^}]*animation:heroCinema/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(markup,/class="hero-copy"/);
  assert.match(markup,/class="skip-link"/);
});
