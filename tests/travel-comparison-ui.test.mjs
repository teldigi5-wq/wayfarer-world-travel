import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(relative)=>readFileSync(new URL(relative,import.meta.url),'utf8');
const ui=read('../travel-research.js');
const css=read('../travel-comparison.css');
const html=read('../index.html');
const api=read('../api/travel-search.js');

test('professional flight cards present leg details, budget and provenance visibly',()=>{
  assert.match(ui,/function flightOfferCard\(offer,index\)/);
  for(const part of ['DEPARTURE','ARRIVAL','JOURNEY DURATION','CONNECTIONS',
    'ESTIMATED GROUP FLIGHT COST','Ticket availability: NOT VERIFIED',
    'Time not supplied','operating status not independently verified']) {
    assert.ok(ui.includes(part),part+' label missing');
  }
  assert.match(ui,/segment\.departureAt/);
  assert.match(ui,/segment\.arrivalAt/);
  assert.match(ui,/totalDurationMinutes/);
  assert.match(ui,/wf-flight-timeline/);
  assert.match(ui,/wf-flight-disclaimer/);
  assert.match(ui,/Return and checkout totals may change/i);
});
test('hotel cards show displayed search total, real dates and truthful room caveats',()=>{
  assert.match(ui,/function hotelOfferCard\(offer,index\)/);
  assert.match(ui,/Lowest displayed search total · NOT a nightly rate/);
  assert.match(ui,/offer\.displayedTotal/);
  assert.match(ui,/offer\.checkIn/);
  assert.match(ui,/offer\.checkOut/);
  assert.match(ui,/taxes, cancellation policy, current room availability/i);
  assert.match(ui,/https:\/\/www\.google\.com\/travel\/hotels/);
  assert.match(ui,/hotelLink\.target='_blank'/);
  assert.match(ui,/hotelLink\.rel='noopener noreferrer'/);
  assert.doesNotMatch(ui,/hotelLink\.href\s*=\s*offer\./);
});
test('client-side sorting never calls the travel API or consumes additional provider credits',()=>{
  const start=ui.indexOf('function resultPanel(');
  const end=ui.indexOf('function show(',start);
  assert.ok(start>0&&end>start);
  const component=ui.slice(start,end);
  for(const name of ['Lowest group estimate','Shortest listed duration','Fewest stops',
    'Lowest displayed total','Hotel name A–Z'])assert.ok(component.includes(name));
  assert.match(component,/select\.addEventListener\('change',render\)/);
  assert.match(component,/list\.replaceChildren\(\.\.\.sorted\.map/);
  assert.doesNotMatch(component,/fetch\(|XMLHttpRequest|\/api\/travel-search/);
  assert.match(api,/bookableSeats:null/);
  assert.match(api,/operationalFlightStatus:'not_connected'/);
});
test('comparison CSS remains visible, responsive and keyboard accessible',()=>{
  assert.match(html,/href="travel-comparison\.css"/);
  assert.ok(html.indexOf('href="travel-comparison.css"')>html.indexOf('href="wayfarer-product.css"'));
  assert.match(css,/\.wf-comparison-grid/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(max-width:375px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.wf-sort-select:focus-visible/);
  assert.match(css,/min-height:46px/);
  assert.doesNotMatch(css,/font-size:\s*(?:9|10|11)px/);
});
