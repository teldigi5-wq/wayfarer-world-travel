import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/airline-offers.mjs';
import {sealAirlineOffer} from '../airline-offer-token.mjs';
import {readFileSync} from 'node:fs';

const secret='wayfarer-test-access-secret-never-production-1234';
const date=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const trip={from:'CMB',to:'HND',checkIn:date(40),checkOut:date(45),adults:2};
const leg=(from,to)=>({
 operating_carrier:{name:'Synthetic Test Airline'},
 operating_carrier_flight_number:'TEST7',
 origin:{iata_code:from},destination:{iata_code:to},
 departing_at:trip.checkIn+'T04:00:00',arriving_at:trip.checkIn+'T13:00:00'
});
let id=0;
const offer=(out,back)=>({
 id:'off_route_fixture_'+String(++id).padStart(4,'0'),
 total_amount:'850.00',total_currency:'USD',live_mode:false,
 expires_at:new Date(Date.now()+20*60000).toISOString(),owner:{name:'Synthetic Test Airline'},
 slices:[{segments:out.map(([f,t])=>leg(f,t))},{segments:back.map(([f,t])=>leg(f,t))}]
});
const good=()=>offer([['CMB','SIN'],['SIN','HND']],[['HND','SIN'],['SIN','CMB']]);

async function mocked(callback){
 const prevFetch=globalThis.fetch;
 const keys=['WAYFARER_AI_BETA_TOKEN','DUFFEL_ACCESS_TOKEN','DUFFEL_MODE',
    'WAYFARER_DUFFEL_ENABLED','WAYFARER_DUFFEL_LIVE_APPROVED'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.WAYFARER_AI_BETA_TOKEN=secret;
 process.env.DUFFEL_ACCESS_TOKEN='duffel_test_fixture-invalid-key';
 process.env.DUFFEL_MODE='test';
 process.env.WAYFARER_DUFFEL_ENABLED='true';
 delete process.env.WAYFARER_DUFFEL_LIVE_APPROVED;
 let payload={offers:[]};
 const requests=[];
 globalThis.fetch=async(url,init)=>{
   const u=new URL(url);
   assert.equal(u.origin,'https://api.duffel.com');
   assert.equal(init.headers.Authorization,'Bearer duffel_test_fixture-invalid-key');
   requests.push({u,init});
   return new Response(JSON.stringify({data:init.method==='POST'?payload:payload.offers[0]}),{status:200});
 };
 const request=async(body,n)=>{
   const out={code:0,data:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},
      status(x){this.code=x;return this},json(d){this.data=d;return this}};
   await handler({method:'POST',
     headers:{'x-wayfarer-beta-token':secret,'x-forwarded-for':'geo-synthetic-route-'+n},
     body},out);
   return out;
 };
 try{await callback({request,setOffers:x=>{payload={offers:x}},requests});}
 finally{
   globalThis.fetch=prevFetch;
   for(const k of keys)if(before[k]===undefined)delete process.env[k];
      else process.env[k]=before[k];
 }
}
test('valid multi-leg Duffel sandbox offers retain both whole verified route slices',async()=>{
 await mocked(async({request,setOffers,requests})=>{
   setOffers([good()]);
   const r=await request({action:'search',trip},1);
   assert.equal(r.code,200);assert.equal(r.data.status,'sandbox_results');
   assert.equal(r.data.offers.length,1);
   const v=r.data.offers[0];
   assert.equal(v.slices[0].segments.length,2);
   assert.equal(v.slices[0].segments[0].from,'CMB');
   assert.equal(v.slices[0].segments[1].from,'SIN');
   assert.equal(v.slices[0].segments.at(-1).to,'HND');
   assert.equal(v.slices[1].segments[0].from,'HND');
   assert.equal(v.slices[1].segments.at(-1).to,'CMB');
   assert.equal(v.bookingConfirmed,false);
   assert.equal(v.availabilityStatus,'sandbox_offer');
   assert.match(v.label,/SANDBOX/);
   assert.ok(v.refreshToken);
   assert.equal(requests.length,1,'No extra supplier calls introduced');
 });
});
test('off-route and broken-connection offers are dropped before prices and encrypted offer tokens',async()=>{
 await mocked(async({request,setOffers})=>{
   setOffers([
     offer([['HND','CMB']],[['CMB','HND']]),
     offer([['CMB','SIN'],['DXB','HND']],[['HND','CMB']]),
     offer([['CMB','SIN']],[['HND','CMB']]),
     offer([['CMB','HND']],[['HND','SIN'],['DXB','CMB']]),
     offer([['CMB','HND']],[['HND','JFK']])
   ]);
   const r=await request({action:'search',trip},2);
   assert.equal(r.code,200);assert.equal(r.data.status,'no_results');
   assert.deepEqual(r.data.offers,[]);
   assert.doesNotMatch(JSON.stringify(r.data),/refreshToken|850.00/);
   assert.match(r.data.message,/integration testing only/i);
 });
});
test('no malformed or truncated provider slice becomes a bookable-looking offer',async()=>{
 await mocked(async({request,setOffers})=>{
   const many=offer([['CMB','HND']],[['HND','CMB']]);
   many.slices[0].segments=Array.from({length:7},()=>leg('CMB','HND'));
   const nil=offer([['CMB','HND']],[['HND','CMB']]);
   nil.slices[1].segments=[null];
   const badCode=offer([['CMB','HND']],[['HND','CMB']]);
   badCode.slices[0].segments[0].destination.iata_code='UNKNOWN';
   const missing=offer([['CMB','HND']],[['HND','CMB']]);
   missing.slices[1].segments=[];
   const cycle=offer([['CMB','CMB'],['CMB','HND']],[['HND','CMB']]);
   setOffers([many,nil,badCode,missing,cycle]);
   const r=await request({action:'search',trip},3);
   assert.equal(r.code,200);assert.equal(r.data.offers.length,0);
   assert.equal(r.data.status,'no_results');
 });
});
test('refresh refuses an offer whose supplier itinerary changed to another region',async()=>{
 await mocked(async({request,setOffers,requests})=>{
   const item=good();setOffers([item]);
   const first=await request({action:'search',trip},4);
   const opaque=first.data.offers[0].refreshToken;
   const invalid={...item,slices:[{segments:[leg('CMB','SIN'),leg('SIN','HND')]},
      {segments:[leg('HND','JFK')]}]};
   setOffers([invalid]);
   const refreshed=await request({action:'refresh',refreshToken:opaque},5);
   assert.equal(refreshed.code,200);
   assert.equal(refreshed.data.status,'expired_or_changed');
   assert.equal(refreshed.data.offers.length,0);
   assert.equal(requests.length,2);
 });
});
test('route validation remains local, sandbox-safe and is applied before encryption',()=>{
 const module=readFileSync(new URL('../api/airline-offers.mjs',import.meta.url),'utf8');
 const helper=readFileSync(new URL('../flight-route-integrity.mjs',import.meta.url),'utf8');
 assert.match(module,/verifiedSegmentRoute\(slices\[0\]\.segments,t\.from,t\.to\)/);
 assert.match(module,/verifiedSegmentRoute\(slices\[1\]\.segments,t\.to,t\.from\)/);
 assert.ok(module.indexOf('if(!verifiedSegmentRoute(slices[0]')<
    module.indexOf('const encrypted=sealAirlineOffer'));
 assert.doesNotMatch(helper,/fetch\(|https:|DUFFEL_ACCESS_TOKEN|api_key/);
 assert.match(module,/SANDBOX — NOT REAL TICKETS/);
});
