import test from 'node:test';
import assert from 'node:assert/strict';
import {signSelection,verifySelection} from '../flight-selection-token.mjs';
import handler from '../api/flight-selection.mjs';

const secret='long-private-beta-test-key-nonproduction-2026';
const trip={from:'CMB',to:'HND',checkIn:'2026-12-01',checkOut:'2026-12-05',adults:2};
const fake='opaqueProviderTokenAbc123_token';
const original={...process.env};
function res(){return {
  statusCode:null,payload:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(code){this.statusCode=code;return this;},
  json(payload){this.payload=payload;return this;}
};}
async function request(selectionToken,extra={}){
  const output=res();
  await handler({method:extra.method||'POST',
    headers:{'x-wayfarer-beta-token':extra.beta??secret,
      'x-forwarded-for':extra.ip||'private-flight-test-2201'},
    body:{selectionToken}},output);
  return output;
}
test('selection envelope binds route and stage to a short-lived HMAC',()=>{
  const t=signSelection('return',fake,trip,secret,100000);
  assert.ok(t);
  assert.equal(verifySelection(t,secret,100001)?.stage,'return');
  assert.equal(verifySelection(t,secret,100001)?.from,'CMB');
  assert.equal(verifySelection(t,'wrong-secret-private-12345678',100001),null);
  assert.equal(verifySelection(t,secret,100000+9*60*1000),null);
  assert.equal(verifySelection(t.slice(0,-4)+'junk',secret,100001),null);
  assert.equal(signSelection('arbitrary',fake,trip,secret),null);
  assert.equal(signSelection('booking','https://evil.example/?key=secret',trip,secret),null);
});
test('no provider requests are made for wrong beta code, expired selection or GET',async()=>{
  process.env.WAYFARER_AI_BETA_TOKEN=secret;
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.SERPAPI_API_KEY='fixture';
  const real=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('never called');};
  try{
    const signed=signSelection('return',fake,trip,secret);
    assert.equal((await request(signed,{beta:'bad'})).statusCode,401);
    assert.equal((await request(signed,{method:'GET'})).statusCode,405);
    assert.equal((await request(signed.slice(0,-1)+'X')).statusCode,400);
    const expired=signSelection('return',fake,trip,secret,Date.now()-10*60*1000);
    assert.equal((await request(expired)).statusCode,400);
    assert.equal(calls,0);
  }finally{globalThis.fetch=real;}
});
test('selected outbound → return options → seller listing, without claiming seats or making bookings',async()=>{
  process.env.WAYFARER_AI_BETA_TOKEN=secret;
  process.env.WAYFARER_TRAVEL_ENABLED='true';
  process.env.SERPAPI_API_KEY='fixture-only';
  const real=globalThis.fetch,requests=[];
  globalThis.fetch=async url=>{
    const u=new URL(url);requests.push(u);
    assert.equal(u.hostname,'serpapi.com');
    assert.equal(u.searchParams.get('api_key'),'fixture-only');
    assert.equal(u.searchParams.get('departure_id'),'CMB');
    assert.equal(u.searchParams.get('arrival_id'),'HND');
    assert.equal(u.searchParams.get('type'),'1');
    if(u.searchParams.has('departure_token')){
      assert.equal(u.searchParams.get('departure_token'),fake);
      assert.equal(u.searchParams.has('booking_token'),false);
      return new Response(JSON.stringify({best_flights:[{
        price:480,total_duration:590,booking_token:'supplierBookingToken456',
        flights:[{airline:'Fixture Airline',flight_number:'FA89',
          departure_airport:{id:'HND',time:'2026-12-05 09:00'},
          arrival_airport:{id:'CMB',time:'2026-12-05 20:15'}}]
      }]}),{status:200});
    }
    assert.equal(u.searchParams.get('booking_token'),'supplierBookingToken456');
    assert.equal(u.searchParams.has('departure_token'),false);
    return new Response(JSON.stringify({
      booking_options:[{separate_tickets:false,together:{
        book_with:'Fixture Airline Direct',airline:true,price:540.33
      }}]
    }),{status:200});
  };
  try{
    const first=await request(signSelection('return',fake,trip,secret));
    assert.equal(first.statusCode,200);
    assert.equal(first.payload.stage,'return_flights');
    assert.equal(first.payload.options[0].pricePerAdult,'480.00');
    assert.equal(first.payload.options[0].ticketAvailability,'not_verified');
    const step=first.payload.options[0].selection;
    assert.equal(step.stage,'booking');
    assert.ok(step.token);
    const second=await request(step.token);
    assert.equal(second.statusCode,200);
    assert.equal(second.payload.stage,'booking_options');
    assert.equal(second.payload.options[0].seller,'Fixture Airline Direct');
    assert.equal(second.payload.options[0].price,'540.33');
    assert.equal(second.payload.options[0].availability,'seller_option_listed');
    assert.equal(second.payload.options[0].seatInventoryVerified,false);
    assert.equal(second.payload.options[0].bookingConfirmed,false);
    assert.equal(requests.length,2);
    assert.equal(second.payload.options[0].bookingLink,undefined);
  }finally{globalThis.fetch=real;}
});
test('no seller results do not become sold-out claims; disabled provider never makes a call',async()=>{
  process.env.WAYFARER_AI_BETA_TOKEN=secret;
  process.env.SERPAPI_API_KEY='fixture-only';
  process.env.WAYFARER_TRAVEL_ENABLED='false';
  const orig=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('should not call provider');};
    const token=signSelection('booking',fake,trip,secret);
    assert.equal((await request(token)).statusCode,503);
    process.env.WAYFARER_TRAVEL_ENABLED='true';
    globalThis.fetch=async()=>new Response(JSON.stringify({booking_options:[]}),{status:200});
    const empty=await request(token);
    assert.equal(empty.statusCode,200);
    assert.equal(empty.payload.options.length,0);
    assert.match(empty.payload.message,/not proof.*sold out/i);
  }finally{globalThis.fetch=orig;}
});
test.after(()=>{
  for(const k of ['SERPAPI_API_KEY','WAYFARER_TRAVEL_ENABLED','WAYFARER_AI_BETA_TOKEN']){
    if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];
  }
});
