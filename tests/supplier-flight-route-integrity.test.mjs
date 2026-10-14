import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedSegmentRoute} from '../flight-route-integrity.mjs';
import searchHandler from '../api/travel-search.js';
import selectionHandler from '../api/flight-selection.mjs';
import {signSelection,verifySelection} from '../flight-selection-token.mjs';
import {readFileSync} from 'node:fs';

const access='fake-very-long-private-beta-code-for-tests-98765';
const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const trip={from:'CMB',to:'HND',destination:'Tokyo',countryCode:'JP',
  latitude:35.6762,longitude:139.6503,
  checkIn:date(38),checkOut:date(43),adults:2,
  flightBudget:1800,groundBudget:1000};
const seg=(from,to)=>({
  airline:'Mock World Air',flight_number:'TEST999',
  departure_airport:{id:from,time:'2030-11-12 09:00'},
  arrival_airport:{id:to,time:'2030-11-12 12:00'}
});
const offer=(legs,price=400,withToken=true)=>({
  price,total_duration:560,flights:legs.map(([from,to])=>seg(from,to)),
  ...(withToken?{departure_token:'FAKE_OPAQUE_DEPARTURE_TOKEN'}:{})
});
function res(){
  return {code:0,data:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this},json(x){this.data=x;return this}};
}
async function mockedNetwork(callback){
  const savedFetch=globalThis.fetch;
  const keys=['WAYFARER_AI_BETA_TOKEN','SERPAPI_API_KEY','WAYFARER_TRAVEL_ENABLED'];
  const initial=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const calls=[];
  process.env.WAYFARER_AI_BETA_TOKEN=access;
  process.env.SERPAPI_API_KEY='unused-fake-test-key';
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  let flights={},hotel={properties:[]};
  globalThis.fetch=async url=>{
    const u=new URL(url);assert.equal(u.hostname,'serpapi.com');
    calls.push(u);
    const body=u.searchParams.get('engine')==='google_flights'?flights:hotel;
    return {ok:true,status:200,text:async()=>JSON.stringify(body)};
  };
  const search=async(number=1)=>{
    const out=res();
    await searchHandler({method:'POST',headers:{
      'x-wayfarer-beta-token':access,'x-forwarded-for':'stage35-search-'+number
    },body:{trip}},out);
    return out;
  };
  const returnOptions=async(token,number=1)=>{
    const out=res();
    await selectionHandler({method:'POST',headers:{
      'x-wayfarer-beta-token':access,'x-forwarded-for':'stage35-return-'+number
    },body:{selectionToken:token}},out);
    return out;
  };
  try{
    await callback({calls,search,returnOptions,setFlights:x=>{flights=x}});
  }finally{
    globalThis.fetch=savedFetch;
    for(const k of keys)if(initial[k]===undefined)delete process.env[k];
      else process.env[k]=initial[k];
  }
}
test('segment validator accepts only entire contiguous origin-to-destination routes',()=>{
  const valid=[{from:'CMB',to:'SIN'},{from:'SIN',to:'HND'}];
  assert.equal(verifiedSegmentRoute(valid,'CMB','HND'),true);
  assert.equal(verifiedSegmentRoute([{from:'CMB',to:'HND'}],'CMB','HND'),true);
  const invalid=[
    [], [{from:'CMB',to:'SIN'}],
    [{from:'HND',to:'CMB'}],
    [{from:'DXB',to:'SIN'},{from:'SIN',to:'HND'}],
    [{from:'CMB',to:'SIN'},{from:'DXB',to:'HND'}],
    [{from:'CMB',to:'CMB'},{from:'CMB',to:'HND'}],
    [{from:'CMB',to:'A1B'},{from:'A1B',to:'HND'}],
    [{from:'CMB',to:'SIN'},{from:'SIN'}],
    [null],Array.from({length:7},()=>({from:'CMB',to:'HND'}))
  ];
  for(const route of invalid)assert.equal(verifiedSegmentRoute(route,'CMB','HND'),false,
    JSON.stringify(route));
  assert.equal(verifiedSegmentRoute(valid,'HND','CMB'),false);
  assert.equal(verifiedSegmentRoute(valid,'CMB','CMB'),false);
});

test('initial protected flight search exposes only provider itineraries matching all requested legs',async()=>{
  await mockedNetwork(async({calls,search,setFlights})=>{
    setFlights({best_flights:[
      offer([['HND','CMB']],300),
      offer([['CMB','SIN'],['DXB','HND']],350),
      offer([['CMB','SIN']],360),
      offer([['CMB','SIN'],['SIN','HND']],410)
    ]});
    const x=await search(1);
    assert.equal(x.code,200);
    assert.equal(calls.filter(u=>u.searchParams.get('engine')==='google_flights').length,1);
    assert.equal(x.data.flights.status,'search_results');
    assert.equal(x.data.flights.offers.length,1);
    const item=x.data.flights.offers[0];
    assert.equal(item.segments[0].from,'CMB');
    assert.equal(item.segments[0].to,'SIN');
    assert.equal(item.segments[1].from,'SIN');
    assert.equal(item.segments[1].to,'HND');
    assert.equal(item.stopCount,1);
    assert.equal(item.perAdult,'410.00');
    assert.equal(item.ticketAvailability,'not_verified');
    assert.equal(item.bookableSeats,null);
    assert.ok(item.selection?.token);
    const state=verifySelection(item.selection.token,access);
    assert.equal(state?.from,'CMB');
    assert.equal(state?.to,'HND');
  });
});
test('invalid supplier flight routes are never given selectable prices or signed tokens',async()=>{
  await mockedNetwork(async({search,setFlights})=>{
    setFlights({best_flights:[
      offer([['HND','CMB']],250),
      offer([['CMB','SIN'],['DXB','HND']],275),
      offer([['CMB','SIN']],280),
      {price:290,flights:[null],departure_token:'bad'}
    ]});
    const x=await search(2);
    assert.equal(x.code,200);
    assert.equal(x.data.flights.status,'no_results');
    assert.equal(x.data.flights.offers.length,0);
    assert.match(x.data.flights.message,/No route-consistent flight price/);
    assert.match(x.data.flights.message,/does not mean flights are sold out/i);
  });
});
test('optional return flight selection validates reverse route before any booking token is created',async()=>{
  await mockedNetwork(async({calls,returnOptions,setFlights})=>{
    const token=signSelection('return','FAKE_OPAQUE_RETURN_TOKEN',trip,access);
    assert.ok(token);
    setFlights({best_flights:[
      {...offer([['CMB','HND']],180),booking_token:'INVALID_DIRECTION'},
      {...offer([['HND','SIN'],['DXB','CMB']],190),booking_token:'INVALID_CONNECTION'},
      {...offer([['HND','SIN'],['SIN','CMB']],220),booking_token:'VALID_RETURN'}
    ]});
    const x=await returnOptions(token,11);
    assert.equal(x.code,200);
    assert.equal(x.data.stage,'return_flights');
    assert.equal(x.data.options.length,1);
    assert.equal(x.data.options[0].segments.at(-1).to,'CMB');
    assert.equal(x.data.options[0].pricePerAdult,'220.00');
    assert.equal(x.data.options[0].ticketAvailability,'not_verified');
    assert.equal(verifySelection(x.data.options[0].selection.token,access)?.providerToken,'VALID_RETURN');
    assert.equal(calls.length,1);
    assert.equal(calls[0].searchParams.get('departure_token'),'FAKE_OPAQUE_RETURN_TOKEN');
  });
});
test('return options with only unrelated airports cannot unlock a booking search',async()=>{
  await mockedNetwork(async({returnOptions,setFlights})=>{
    const token=signSelection('return','FAKE_OPAQUE_RETURN_TOKEN',trip,access);
    setFlights({best_flights:[
      {...offer([['CMB','HND']],190),booking_token:'SOME_OTHER_DIRECTION'},
      {...offer([['HND','SIN'],['DXB','CMB']],180),booking_token:'GAP'},
      {price:150,flights:[null],booking_token:'BAD'}
    ]});
    const x=await returnOptions(token,12);
    assert.equal(x.code,200);
    assert.equal(x.data.options.length,0);
    assert.match(x.data.message,/No route-consistent return choices/);
    assert.doesNotMatch(JSON.stringify(x.data),/SOME_OTHER_DIRECTION|GAP|BAD/);
  });
});
test('both supplier endpoints share the same pure local route validator, not another API',()=>{
  const flight=readFileSync(new URL('../api/travel-search.js',import.meta.url),'utf8');
  const ret=readFileSync(new URL('../api/flight-selection.mjs',import.meta.url),'utf8');
  const helper=readFileSync(new URL('../flight-route-integrity.mjs',import.meta.url),'utf8');
  assert.match(flight,/verifiedSegmentRoute\(segments,t\.from,t\.to\)/);
  assert.match(ret,/verifiedSegmentRoute\(segments,state\.to,state\.from\)/);
  assert.doesNotMatch(helper,/fetch\(|https:|GROQ_|SERPAPI_|api_key/);
});
