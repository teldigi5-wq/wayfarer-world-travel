import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../travel-research.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../wayfarer-product.css',import.meta.url),'utf8');

test('flight external handoff opens an established research provider in a separate tab',()=>{
  assert.match(js,/function addExternalHandoff\(card,details\)/);
  assert.match(js,/link\.href='https:\/\/www\.google\.com\/travel\/flights'/);
  assert.match(js,/link\.target='_blank'/);
  assert.match(js,/link\.rel='noopener noreferrer'/);
  assert.match(js,/addExternalHandoff\(card,/);
  assert.match(js,/addExternalHandoff\(result,/);
  assert.match(js,/addExternalHandoff\(sellerCard,/);
});
test('flight CTA never claims checkout, final price or a matched deep link',()=>{
  assert.match(js,/Re-select the same dates and flights there/);
  assert.match(js,/final payable fare before purchasing/);
  assert.match(js,/Ticket availability: NOT VERIFIED/);
  assert.match(js,/NOT a confirmed booking/);
  assert.doesNotMatch(js,/window\.location\s*=|location\.href\s*=/);
});
test('copy itinerary does not leak supplier auth details',()=>{
  assert.match(js,/navigator\.clipboard\.writeText\(details\)/);
  assert.match(js,/navigator\.clipboard\?\.writeText/);
  assert.doesNotMatch(js,/navigator\.clipboard\.writeText\(selection\.token\)/);
  assert.match(js,/Clipboard unavailable/);
});
test('flight research handoff is readable on mobile and supports keyboard focus',()=>{
  assert.match(styles,/\.wf-flight-compare-link:focus-visible/);
  assert.match(styles,/\.wf-flight-copy:focus-visible/);
  assert.match(styles,/min-height:48px/);
  assert.match(styles,/@media\(max-width:610px\)/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});
