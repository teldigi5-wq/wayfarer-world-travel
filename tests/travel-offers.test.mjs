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
test('travel offer route refuses unauthenticated users and GET methods', async()=>{
  configure();
  assert.equal((await send({trip},'incorrect')).statusCode,401);
  assert.equal((await send({trip},'not-real-secret-for-tests','GET')).statusCode,405);
});
test('retired Amadeus integration stays disconnected even when old credentials are configured',async()=>{
  configure('production');
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('retired provider must never be contacted');};
    const value=await send();
    assert.equal(value.statusCode,200);
    assert.equal(value.data.mode,'retired_provider');
    for(const name of ['flights','hotels','food','transport']){
      assert.equal(value.data[name].status,'not_connected');
      assert.equal(value.data[name].results.length,0);
    }
    assert.match(value.data.flights.message,/discontinued/i);
  }finally{globalThis.fetch=previous;}
});
test('invalid airport and negative separate flight budget are rejected',async()=>{
  configure('production');
  assert.equal((await send({trip:{...trip,destinationAirport:'A1'}})).statusCode,400);
  assert.equal((await send({trip:{...trip,flightBudget:-100}})).statusCode,400);
});
test('legacy adapter never treats group size as verified hotel room inventory',async()=>{
  configure('production');
  const value=await send({trip:{...trip,travelers:3}});
  assert.equal(value.data.hotels.status,'not_connected');
});
test.after(()=> {
  for (const key of ['WAYFARER_AI_BETA_TOKEN','WAYFARER_TRAVEL_ENABLED','AMADEUS_CLIENT_ID','AMADEUS_CLIENT_SECRET','AMADEUS_ENV']) {
    if (initial[key] === undefined) delete process.env[key];
    else process.env[key]=initial[key];
  }
});
