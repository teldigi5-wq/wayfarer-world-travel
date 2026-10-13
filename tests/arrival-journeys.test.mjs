import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../arrival-journeys.css',import.meta.url),'utf8');
const script=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');

test('arrival and journeys have unique semantic screen landmarks and functional controls',()=>{
  for(const id of ['arrival-page-heading','arrival-title','arrival-context-destination','arrival-context-duration','arrival-context-budget','ring','ready-value','arr-source','refresh','maps','download','arrival-edit-trip','arrival-journeys-link','arrival-map-secondary','journeys-page-heading','journey-create','journey-search','journey-count','saved']) {
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`Expected exactly one #${id}`);
  }
  assert.equal((html.match(/data-check="/g)||[]).length,4);
  assert.match(html,/<section class="view" id="arrival" aria-labelledby="arrival-page-heading">/);
  assert.match(html,/<section class="view" id="trips" aria-labelledby="journeys-page-heading">/);
  assert.match(html,/arrival-journeys\.css/);
});

test('saved trip actions avoid unsafe HTML interpolation and support worldwide destinations',()=>{
  const start=script.indexOf('function renderTrips()');const end=script.indexOf("$('#story-btn')",start);
  assert.ok(start>=0&&end>start);
  const render=script.slice(start,end);
  assert.match(render,/document\.createElement\('article'\)/);
  assert.match(render,/\.textContent=t\.destination/);
  assert.match(render,/t\.worldPlace/);
  assert.match(render,/resumeTrip\(true\)/);
  assert.match(render,/Confirm removal/);
  assert.match(render,/addEventListener\('input',renderTrips\)/);
  assert.doesNotMatch(render,/innerHTML\s*=/);
  assert.match(script,/wf-trips-v2/);
  assert.match(script,/wf-checks-v2/);
});

test('source links are https only, and provider data remains explicitly unverified',()=>{
  assert.match(script,/url\.protocol!=='https:'/);
  assert.match(script,/noopener noreferrer/);
  assert.match(html,/Visa rules and transport schedules are not connected/);
  assert.match(html,/Local to this browser/);
  assert.match(html,/not evidence that a service, visa, or reservation is confirmed/);
});

test('Arrival and My Journeys are responsive and respect motion preferences',()=>{
  assert.match(css,/#arrival \.wf-arrival-grid/);
  assert.match(css,/#trips \.wf-journey-grid/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.motion-off/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/wayfarer-hero-v3\.jpg/);
  assert.doesNotMatch(css,/animation:\s*infinite/);
});
