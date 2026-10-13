import test from 'node:test';
import assert from 'node:assert/strict';
import {countrySuggestions,airportOptions,airportLabel,validateSelectedAirport} from '../airports.mjs';
import {buildAirportCatalog} from '../scripts/refresh-airports.mjs';
test('country suggestions accent-insensitive and deterministic',()=>{
  const all=[{code:'AX',name:'Åland Islands'},{code:'JP',name:'Japan'},{code:'JM',name:'Jamaica'}];
  assert.deepEqual(countrySuggestions(all,'ala').map(x=>x.code),['AX']);
  assert.deepEqual(countrySuggestions(all,'ja').map(x=>x.code),['JM','JP']);
});
test('airports are narrowed to chosen country and prioritized by matching municipality',()=>{
  const catalog=[
    {name:'Narita International Airport',code:'JP',iata:'NRT',municipality:'Narita',scheduledService:true,type:'large_airport'},
    {name:'Tokyo Haneda Airport',code:'JP',iata:'HND',municipality:'Tokyo',scheduledService:true,type:'large_airport'},
    {name:'Test Airport',code:'LK',iata:'CMB',municipality:'Colombo',scheduledService:true,type:'large_airport'},
  ];
  assert.deepEqual(airportOptions(catalog,{country:'JP',city:'Tokyo'}).map(x=>x.iata),['HND','NRT']);
  assert.deepEqual(airportOptions(catalog,{query:'Colombo'}).map(x=>x.iata),['CMB']);
  assert.equal(validateSelectedAirport('HND',catalog,'JP'),'HND');
  assert.equal(validateSelectedAirport('CMB',catalog,'JP'),'');
  assert.match(airportLabel(catalog[1]),/Tokyo Haneda/);
});
test('CSV handles quoted names, rejects closed/invalid entries and avoids false service claims',()=>{
  const header='id,ident,type,name,latitude_deg,longitude_deg,continent,iso_country,iso_region,municipality,scheduled_service,iata_code';
  const rows=['1,RJTT,large_airport,"Tokyo, Haneda",35.55,139.77,AS,JP,JP-13,Tokyo,yes,HND'];
  for(let i=0;i<1000;i++){
    const code=''+String.fromCharCode(65+Math.floor(i/676)%26)+String.fromCharCode(65+Math.floor(i/26)%26)+String.fromCharCode(65+i%26);
    rows.push((i+2)+',TEST'+i+',small_airport,Sample '+i+',, ,AS,JP,JP-13,Example,no,'+code);
  }
  rows.push('1100,DEAD,closed,Closed Terminal,3,3,AS,JP,JP-13,Closed,no,ZZZ');
  const result=buildAirportCatalog(header+'\n'+rows.join('\n')+'\n');
  assert.ok(result.airports.length>=1000);
  const tokyo=result.airports.find(x=>x.iata==='HND');
  assert.equal(tokyo.name,'Tokyo, Haneda');
  assert.equal(tokyo.scheduledService,true);
  assert.ok(!result.airports.some(a=>a.iata==='ZZZ'));
  assert.match(result.usage,/not proof/);
});
