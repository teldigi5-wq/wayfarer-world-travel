import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/travel-offers.mjs';

const initial = { ...process.env };
const trip = {
  country:'Japan', city:'Tokyo', origin:'Colombo',
  startDate:'2026-12-01', endDate:'2026-12-05', travelers:2,
  budget:1200, style:'balanced'
};
function res() {
  return { statusCode:200, headers:{}, data:null,
    setHeader(k,v){this.headers[k]=v;},
    status(code){this.statusCode=code;return this;},
    json(value){this.data=value;return this;}
  };
}
function configure(mode='production') {
  process.env.WAYFARER_AI_BETA_TOKEN='not-real-secret-for-tests';
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.AMADEUS_CLIENT_ID='fixture-client-id';
  process.env.AMADEUS_CLIENT_SECRET='fixture-client-secret';
  process.env.AMADEUS_ENV=mode;
}
async function send(body={trip},secret='not-real-secret-for-tests',method='POST') {
  const value=res();
  await handler({method,headers:{'x-wayfarer-beta-token':secret},body},value);
  return value;
}
function mockedFetch(destination='TYO') {
  return async (url, init) => {
    const path = String(url);
    if (path.includes('oauth2/token')) {
      assert.equal(init.method,'POST');
      return new Response(JSON.stringify({access_token:'fixture-token'}),{status:200});
    }
    assert.equal(init.headers.Authorization,'Bearer fixture-token');
    if (path.includes('/reference-data/locations?')) {
      const q=new URL(path).searchParams;
      const city=q.get('keyword');
      return new Response(JSON.stringify({data:[{
        name:city?.toUpperCase(),subType:'CITY',iataCode:city==='Tokyo'?'TYO':'CMB',
        address:{cityName:city?.toUpperCase()}
      }]}),{status:200});
    }
    if (path.includes('/v2/shopping/flight-offers?')) {
      assert.ok(path.includes('originLocationCode=CMB'));
      assert.ok(path.includes('destinationLocationCode='+destination));
      return new Response(JSON.stringify({data:[{
        price:{grandTotal:'840.50',currency:'USD'},numberOfBookableSeats:3,
        itineraries:[{segments:[{
          carrierCode:'ZZ',number:'123',departure:{iataCode:'CMB',at:'2026-12-01T10:00:00'},
          arrival:{iataCode:'TYO',at:'2026-12-01T20:00:00'}
        }]}]
      }]}),{status:200});
    }
    if (path.includes('/v1/reference-data/locations/hotels/by-city?')) {
      return new Response(JSON.stringify({data:[{hotelId:'ABTYO123'}]}),{status:200});
    }
    if (path.includes('/v3/shopping/hotel-offers?')) {
      assert.ok(path.includes('roomQuantity=1'));
      return new Response(JSON.stringify({data:[{
        hotel:{name:'Fixture Hotel Only'},
        offers:[{checkInDate:'2026-12-01',checkOutDate:'2026-12-05',price:{total:'450.00',currency:'USD'}}]
      }]}),{status:200});
    }
    throw Error('Unexpected provider request: '+path);
  };
}

test('travel offer route refuses unauthenticated users and GET methods', async()=>{
  configure();
  assert.equal((await send({trip},'incorrect')).statusCode,401);
  assert.equal((await send({trip},'not-real-secret-for-tests','GET')).statusCode,405);
});
test('no credentials means no live prices and no provider call',async()=>{
  configure();
  delete process.env.AMADEUS_CLIENT_ID;
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=async()=>{throw Error('should not call provider');};
    const value=await send();
    assert.equal(value.statusCode,200);
    assert.equal(value.data.mode,'not_configured');
    assert.equal(value.data.flights.status,'not_connected');
    assert.equal(value.data.hotels.status,'not_connected');
    assert.equal(value.data.food.status,'not_connected');
    assert.equal(value.data.transport.status,'not_connected');
  } finally {globalThis.fetch=previous;}
});
test('production provider offer results show only returned fares, not bookings',async()=>{
  configure('production');
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=mockedFetch();
    const value=await send();
    assert.equal(value.statusCode,200);
    assert.equal(value.data.mode,'production');
    assert.equal(value.data.flights.status,'offers_found');
    assert.equal(value.data.flights.results[0].price,'840.50');
    assert.equal(value.data.flights.results[0].currency,'USD');
    assert.equal(value.data.flights.results[0].seatsReported,3);
    assert.match(value.data.flights.results[0].bookingStatus,/not booked/i);
    assert.equal(value.data.hotels.status,'offers_found');
    assert.equal(value.data.hotels.results[0].price,'450.00');
    assert.match(value.data.hotels.results[0].bookingStatus,/not reserved/i);
    assert.equal(value.data.food.results.length,0);
    assert.equal(value.data.transport.results.length,0);
    assert.equal(JSON.stringify(value.data).includes('fixture-token'),false);
  } finally {globalThis.fetch=previous;}
});
test('Amadeus test environment is never labeled live',async()=>{
  configure('test');
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=mockedFetch();
    const value=await send();
    assert.equal(value.data.mode,'test');
    assert.equal(value.data.flights.status,'test_data');
    assert.equal(value.data.hotels.status,'test_data');
    assert.match(value.data.flights.message,/NOT LIVE/i);
  } finally {globalThis.fetch=previous;}
});

test('selected IATA airports override city code and fares are compared to separate airfare limit',async()=>{
  configure('production');
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=mockedFetch('NRT');
    const value=await send({trip:{...trip,originAirport:'CMB',destinationAirport:'NRT',flightBudget:800}});
    assert.equal(value.statusCode,200);
    assert.equal(value.data.flights.status,'offers_found');
    assert.equal(value.data.flights.results[0].budgetFit,'over_budget');
    assert.equal(value.data.flights.results[0].budgetLimitUsd,800);
    assert.equal(value.data.hotels.results[0].budgetFit,'within_budget');
    assert.equal(value.data.hotels.results[0].budgetLimitUsd,480);
  } finally {globalThis.fetch=previous;}
});
test('invalid airport and negative separate flight budget are rejected',async()=>{
  configure('production');
  assert.equal((await send({trip:{...trip,destinationAirport:'A1'}})).statusCode,400);
  assert.equal((await send({trip:{...trip,flightBudget:-100}})).statusCode,400);
});
test('three travelers require room layout, never inferred hotel availability',async()=>{
  configure('production');
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=mockedFetch();
    const value=await send({trip:{...trip,travelers:3}});
    assert.equal(value.data.hotels.status,'needs_details');
  } finally {globalThis.fetch=previous;}
});
test('provider outage returns unavailable, not falsely sold-out',async()=>{
  configure('production');
  const previous=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response('unavailable',{status:503});
    const value=await send();
    assert.equal(value.statusCode,200);
    assert.equal(value.data.flights.status,'unavailable');
    assert.equal(value.data.hotels.status,'unavailable');
  } finally {globalThis.fetch=previous;}
});
test.after(()=> {
  for (const key of ['WAYFARER_AI_BETA_TOKEN','WAYFARER_TRAVEL_ENABLED','AMADEUS_CLIENT_ID','AMADEUS_CLIENT_SECRET','AMADEUS_ENV']) {
    if (initial[key] === undefined) delete process.env[key];
    else process.env[key]=initial[key];
  }
});
