import test from 'node:test';
import assert from 'node:assert/strict';
import {sealAirlineOffer,openAirlineOffer} from '../airline-offer-token.mjs';
import {signSelection,verifySelection} from '../flight-selection-token.mjs';
import handler from '../api/airline-offers.mjs';
import {readFileSync} from 'node:fs';
const old={...process.env};
const code='private-test-only-wayfarer-beta-secret-12345678';
const from='CMB',to='HND';
const nowDay=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const trip={from,to,checkIn:nowDay(45),checkOut:nowDay(50),adults:2};
const flight=(origin,destination,date)=>({
  segments:[{operating_carrier:{name:'Duffel Airways'},operating_carrier_flight_number:'4242',
    origin:{iata_code:origin},destination:{iata_code:destination},
    departing_at:date+'T08:35:00',arriving_at:date+'T18:45:00'}]
});
const sampleOffer={id:'off_00009htYpSCXrwaB9DnUm0',
  owner:{name:'Duffel Airways'},total_amount:'960.00',total_currency:'USD',
  expires_at:new Date(Date.now()+15*60000).toISOString(),live_mode:false,
  slices:[flight(from,to,trip.checkIn),flight(to,from,trip.checkOut)]};
function setEnv(active=true){
  process.env.WAYFARER_AI_BETA_TOKEN=code;
  process.env.WAYFARER_DUFFEL_ENABLED=active?'true':'false';
  process.env.DUFFEL_MODE='test';
  process.env.DUFFEL_ACCESS_TOKEN='duffel_test_fixture-token-not-a-real-key';
  delete process.env.WAYFARER_DUFFEL_LIVE_APPROVED;
}
function makeRes(){
  return {statusCode:null,body:null,headers:{},
    setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.statusCode=v;return this;},
    json(v){this.body=v;return this;}};
}
async function req(body,opts={}){
  const response=makeRes();
  await handler({method:opts.method||'POST',
    headers:{'x-wayfarer-beta-token':opts.beta??code,
      'x-forwarded-for':opts.ip||'test-airline-'+(opts.suffix||'1')},
    body},response);
  return response;
}
test('supplier offer and SerpApi selection tokens are encrypted, bound and expire',()=>{
  const t=sealAirlineOffer('off_00009htYpSCXrwaB9DnUm0','test',trip,code,1000000);
  assert.ok(t?.startsWith('wf-air1.'));
  assert.doesNotMatch(t,/off_00009htYpSCXrwaB9DnUm0/);
  assert.equal(openAirlineOffer(t,code,1000001)?.mode,'test');
  assert.equal(openAirlineOffer(t,code,1000001)?.from,'CMB');
  assert.equal(openAirlineOffer(t,code,1000001)?.adults,2);
  assert.equal(openAirlineOffer(t,code,1000000+13*60000),null);
  assert.equal(openAirlineOffer(t.slice(0,-3)+'xxx',code,1000001),null);
  assert.equal(openAirlineOffer(t,'different-long-test-only-secret',1000001),null);
  const selection=signSelection('return','OpaqueSupplierSessionExample123',trip,code,1000000);
  assert.ok(selection?.startsWith('wf2.'));
  assert.doesNotMatch(selection,/OpaqueSupplierSessionExample123/);
  assert.equal(verifySelection(selection,code,1000001)?.providerToken,'OpaqueSupplierSessionExample123');
  assert.equal(verifySelection(selection,code,1000000+9*60000),null);
});
test('missing connection, invalid beta passcode and invalid dates never call supplier',async()=>{
  setEnv(false);
  const before=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('must not call supplier');};
  try{
    assert.equal((await req({action:'search',trip},{beta:'wrong'})).statusCode,401);
    assert.equal((await req({action:'search',trip},{method:'GET'})).statusCode,405);
    assert.equal((await req({action:'search',trip:{...trip,from:'XXXX'}}, {suffix:'invalid'})).statusCode,400);
    const disconnected=await req({action:'search',trip},{suffix:'off'});
    assert.equal(disconnected.statusCode,200);
    assert.equal(disconnected.body.status,'not_connected');
    assert.equal(disconnected.body.offers.length,0);
  }finally{globalThis.fetch=before;}
});
test('Duffel sandbox offers are explicitly marked TEST and can be refreshed without booking',async()=>{
  setEnv(true);
  const originalFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async (url,opts)=>{
    const u=new URL(url);calls.push({u,opts});
    assert.equal(u.origin,'https://api.duffel.com');
    assert.equal(opts.headers.Authorization,'Bearer duffel_test_fixture-token-not-a-real-key');
    assert.equal(opts.headers['Duffel-Version'],'v2');
    if(opts.method==='POST'){
      assert.equal(u.pathname,'/air/offer_requests');
      const raw=JSON.parse(opts.body);
      assert.equal(raw.data.cabin_class,'economy');
      assert.equal(raw.data.slices[0].origin,'CMB');
      assert.equal(raw.data.slices[0].destination,'HND');
      assert.equal(raw.data.passengers.length,2);
      return new Response(JSON.stringify({data:{offers:[sampleOffer]}}),{status:200});
    }
    assert.equal(opts.method,'GET');
    assert.equal(u.pathname,'/air/offers/'+sampleOffer.id);
    return new Response(JSON.stringify({data:sampleOffer}),{status:200});
  };
  try{
    const searched=await req({action:'search',trip},{suffix:'search'});
    assert.equal(searched.statusCode,200);
    assert.equal(searched.headers['Cache-Control'],'no-store');
    assert.equal(searched.body.status,'sandbox_results');
    assert.equal(searched.body.offers.length,1);
    const quote=searched.body.offers[0];
    assert.equal(quote.operatingCarrier,'Duffel Airways');
    assert.equal(quote.totalAmount,'960.00');
    assert.equal(quote.currency,'USD');
    assert.equal(quote.slices.length,2);
    assert.equal(quote.slices[0].segments[0].operatingCarrier,'Duffel Airways');
    assert.equal(quote.seatCountVerified,false);
    assert.equal(quote.bookingConfirmed,false);
    assert.match(quote.label,/SANDBOX/);
    assert.equal(quote.availabilityStatus,'sandbox_offer');
    assert.ok(quote.refreshToken);
    const refreshed=await req({action:'refresh',refreshToken:quote.refreshToken},{suffix:'refresh'});
    assert.equal(refreshed.statusCode,200);
    assert.equal(refreshed.body.status,'sandbox_refreshed');
    assert.equal(refreshed.body.offers[0].bookingConfirmed,false);
    assert.equal(calls.length,2);
    assert.equal(JSON.stringify(searched.body).includes('duffel_test_fixture'),false);
    assert.equal(calls.some(x=>/orders|payments/.test(x.u.pathname)),false);
  }finally{globalThis.fetch=originalFetch;}
});
test('live mode cannot accidentally activate from a test credential or a live token alone',async()=>{
  setEnv(true);
  process.env.DUFFEL_MODE='live';
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('unexpected paid supplier call');};
  try{
    let result=await req({action:'search',trip},{suffix:'live-test'});
    assert.equal(result.body.status,'not_connected');
    process.env.DUFFEL_ACCESS_TOKEN='duffel_live_fixture-not-real';
    result=await req({action:'search',trip},{suffix:'live-disabled'});
    assert.equal(result.body.status,'not_connected');
    process.env.WAYFARER_DUFFEL_LIVE_APPROVED='true';
    // Still no call in this test; remove explicit approval before finishing.
    process.env.WAYFARER_DUFFEL_LIVE_APPROVED='false';
    result=await req({action:'search',trip},{suffix:'live-false'});
    assert.equal(result.body.status,'not_connected');
  }finally{globalThis.fetch=originalFetch;}
});
test('even an explicitly approved live supplier quote is NEVER a confirmed ticket',async()=>{
  setEnv(true);
  process.env.DUFFEL_MODE='live';
  process.env.DUFFEL_ACCESS_TOKEN='duffel_live_fixture-not-real';
  process.env.WAYFARER_DUFFEL_LIVE_APPROVED='true';
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({data:{
    offers:[{...sampleOffer,live_mode:true}]} }),{status:200});
  try{
    const response=await req({action:'search',trip},{suffix:'approved-live-quote'});
    assert.equal(response.statusCode,200);
    assert.equal(response.body.mode,'live');
    assert.equal(response.body.status,'supplier_offers');
    assert.equal(response.body.offers.length,1);
    assert.equal(response.body.offers[0].availabilityStatus,'supplier_offer_unbooked');
    assert.equal(response.body.offers[0].seatCountVerified,false);
    assert.equal(response.body.offers[0].bookingConfirmed,false);
    assert.match(response.body.offers[0].label,/NOT RESERVED/);
  }finally{globalThis.fetch=previous;}
});
test('unverified, expired and wrong-mode offers cannot be listed as available',async()=>{
  setEnv(true);
  const oldFetch=globalThis.fetch;
  const past={...sampleOffer,expires_at:new Date(Date.now()-1000).toISOString()};
  const wrongMode={...sampleOffer,live_mode:true};
  globalThis.fetch=async()=>new Response(JSON.stringify({data:{offers:[past,wrongMode]}}),{status:200});
  try{
    const response=await req({action:'search',trip},{suffix:'wrong-mode'});
    assert.equal(response.statusCode,200);
    assert.equal(response.body.status,'no_results');
    assert.equal(response.body.offers.length,0);
    assert.match(response.body.message,/test/i);
  }finally{globalThis.fetch=oldFetch;}
});
test('tampered airline recheck reference is denied before supplier call',async()=>{
  setEnv(true);
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('unexpected network');};
  try{
    const token=sealAirlineOffer(sampleOffer.id,'test',trip,code);
    assert.equal((await req({action:'refresh',refreshToken:token.slice(0,-1)+'x'},{suffix:'badtoken'})).statusCode,400);
    assert.equal((await req({action:'refresh',refreshToken:'off_random'},{suffix:'rawid'})).statusCode,400);
  }finally{globalThis.fetch=oldFetch;}
});
test.after(()=>{
  for(const key of ['WAYFARER_AI_BETA_TOKEN','WAYFARER_DUFFEL_ENABLED','DUFFEL_MODE','DUFFEL_ACCESS_TOKEN','WAYFARER_DUFFEL_LIVE_APPROVED']){
    if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];
  }
});
