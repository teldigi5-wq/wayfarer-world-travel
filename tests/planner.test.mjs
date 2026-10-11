import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTrip,estimateBudget,haversine,rankHotels,buildItinerary,bookingLinks,runAgents} from '../planner.mjs';
const trip={country:'Japan',city:'Tokyo',origin:'Colombo',startDate:'2027-02-01',endDate:'2027-02-03',travelers:2,budget:600};
test('validates calendar dates, order, length and group/budget bounds',()=>{
  assert.equal(validateTrip(trip).days,3);
  for(const change of [{startDate:'2027-02-30'},{endDate:'2027-01-31'},{endDate:'2027-03-03'},{travelers:1.5},{travelers:0},{budget:Infinity},{budget:-1},{country:''}]) assert.equal(validateTrip({...trip,...change}).valid,false);
  assert.equal(validateTrip({...trip,endDate:'2027-03-02'}).days,30);
});
test('budget allocation preserves total and explicitly excludes flights',()=>{
  const budget=estimateBudget({...trip,budget:101.03});
  assert.ok(Math.abs(budget.breakdown.reduce((s,c)=>s+c.amount,0)-101.03)<0.001);
  assert.match(budget.disclaimer,/excludes flights/);
  assert.equal(estimateBudget(trip).perPersonPerDay,100);
});
test('hotel proximity ranks valid coordinates by straight-line distance',()=>{
  assert.equal(haversine({lat:0,lon:0},{lat:0,lon:0}),0);
  assert.equal(haversine({lat:null,lon:0},{lat:0,lon:0}),null);
  assert.ok(Math.abs(haversine({lat:0,lon:0},{lat:0,lon:1})-111.195)<.01);
  const hotels=rankHotels([{name:'Far',lat:0,lon:1},{name:'Near',lat:0,lon:.1},{name:'Invalid',lat:100,lon:0}],{lat:0,lon:0});
  assert.deepEqual(hotels.map(h=>h.name),['Near','Far']);
  assert.match(hotels[0].distanceLabel,/Straight-line/);
});
test('itinerary consumes supplied attractions once and preserves dates',()=>{
  const itinerary=buildItinerary(trip,[{name:'A'},{name:'B'},{name:'C'}]);
  assert.deepEqual(itinerary.map(d=>d.date),['2027-02-01','2027-02-02','2027-02-03']);
  assert.equal(itinerary[1].activities[0].name,'A');
  assert.equal(itinerary[2].activities[0].name,'C');
  assert.match(itinerary[0].activities[0].note,/No verified/);
});
test('outbound links keep user input as encoded query data',()=>{
  const links=bookingLinks({...trip,city:'<script>&redirect=https://evil.test'});
  for(const link of Object.values(links)) assert.equal(new URL(link).protocol,'https:');
  assert.equal(new URL(links.hotels).hostname,'www.booking.com');
  assert.match(new URL(links.hotels).searchParams.get('ss'),/^<script>&redirect=/);
  assert.equal(new URL(links.hotels).searchParams.get('redirect'),null);
});
test('six free planning agents reject invalid input before producing results',()=>{
  assert.equal(runAgents(trip).agents.length,6);
  assert.equal(runAgents({...trip,budget:0}).valid,false);
  assert.equal(runAgents({...trip,budget:0}).budget,undefined);
});
