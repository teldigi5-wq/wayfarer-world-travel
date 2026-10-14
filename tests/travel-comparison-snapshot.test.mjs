import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('travel-research.js');
const a=source.indexOf('  function researchSnapshot(res){');
const b=source.indexOf('  let showingSupplierResults=',a);
assert.ok(a>0&&b>a,'real first-party comparison summary and show functions must be present');

const full={
  source:'SerpApi Google Travel Search',checkedAt:'2026-10-14T11:00:00Z',
  flights:{status:'search_results',message:'Supplier-reported flight schedule only',offers:[
    {currency:'USD',estimatedGroup:'980.00',perAdult:'490.00'},
    {currency:'USD',estimatedGroup:'840.00',perAdult:'420.00'},
    {currency:'USD',estimatedGroup:'1000.00',perAdult:'500.00'}
  ]},
  hotels:{status:'search_results',message:'No room verified',offers:[
    {currency:'USD',displayedTotal:'620.00'},
    {currency:'USD',displayedTotal:'420.00'},
    {currency:'USD',displayedTotal:'510.00'}
  ]},
  food:{status:'not_connected',message:'Not connected',offers:[]},
  transport:{status:'not_connected',message:'Not connected',offers:[]},
  note:'No tickets or rooms have been booked'
};
function node(tag,value='',className=''){
  return {tag,tagName:tag,className,textContent:String(value),children:[],
    attrs:{},setAttribute(k,v){this.attrs[k]=v;},
    append(...children){this.children.push(...children)},
    replaceChildren(...children){this.children=children}
  };
}
function fixture(){
  const output=node('div','', 'travel-search-output');
  const env={
    word:node,output,
    money:(value,currency='USD')=>currency+' '+value,
    resultPanel:(label)=>node('section',label,'wf-compare-panel'),
    panel:(label)=>node('article',label,'wf-other-panel'),
    itemCard:()=>node('article','No verified price'),
    localeTime:()=> 'Checked · provider time'
  };
  vm.runInNewContext(source.slice(a,b)+
    '\nthis.researchSnapshot=researchSnapshot;this.show=show;',env,{timeout:1000});
  return {env,output};
}
function flatten(x){return [x,...x.children.flatMap(flatten)]}
function visible(x){return flatten(x).map(v=>v.textContent).join(' | ')}
test('snapshot uses source-returned OUTBOUND group flight and stay displayed totals separately',()=>{
 const f=fixture(),result=f.env.researchSnapshot(full);
 assert.equal(result.outbound.count,3);
 assert.equal(result.outbound.lowest,840);
 assert.equal(result.stays.count,3);
 assert.equal(result.stays.lowest,420);
 assert.equal(result.source,'SerpApi Google Travel Search');
 f.env.show(full);
 const snapshot=f.output.children[0];
 assert.equal(snapshot.className,'wf-research-snapshot');
 assert.equal(snapshot.attrs['aria-label'],'Travel research summary');
 assert.match(visible(snapshot),/USD 840\.00/);
 assert.match(visible(snapshot),/USD 420\.00/);
 assert.match(visible(snapshot),/Not a round-trip ticket total/);
 assert.match(visible(snapshot),/Not a confirmed payable room price/);
 assert.match(visible(snapshot),/not an added-up trip price/);
 assert.doesNotMatch(visible(snapshot),/USD 1260\.00|USD 2520\.00/);
 assert.equal(f.output.children[1].className,'wf-comparison-grid');
});

test('missing or provider-disabled quote sources produce unavailable, never synthetic amounts',()=>{
 const f=fixture();
 const noConnection={
   checkedAt:null,source:'Provider not enabled',
   flights:{status:'not_connected',offers:[]},
   hotels:{status:'unavailable',offers:[]},
   food:{status:'not_connected',message:'No source'},
   transport:{status:'not_connected',message:'No source'},note:'Not connected'
 };
 const data=f.env.researchSnapshot(noConnection);
 assert.equal(data.outbound.count,0);
 assert.equal(data.outbound.lowest,null);
 assert.equal(data.stays.lowest,null);
 f.env.show(noConnection);
 assert.match(visible(f.output.children[0]),/Not available/);
 assert.match(visible(f.output.children[0]),/0 usable source options/);
 assert.doesNotMatch(visible(f.output.children[0]),/USD [0-9]/);
});

test('does not mix currencies, unsupported prices or unconfirmed source statuses',()=>{
 const f=fixture();
 const input={
   flights:{status:'search_results',offers:[
     {currency:'USD',estimatedGroup:'690.00'},
     {currency:'EUR',estimatedGroup:'400.00'},
     {currency:'USD',estimatedGroup:'0.00'},
     {currency:'USD',estimatedGroup:'not a fare'},
     {currency:'USD',estimatedGroup:1.2},
     {currency:'USD',estimatedGroup:'900.00'}
   ]},
   hotels:{status:'not_connected',offers:[{currency:'USD',displayedTotal:'1.00'}]}
 };
 const data=f.env.researchSnapshot(input);
 assert.equal(data.outbound.count,6,'Count describes returned options, not verified seat inventory');
 assert.equal(data.outbound.lowest,690);
 assert.equal(data.stays.count,0);
 assert.equal(data.stays.lowest,null);
});

test('new search results replace old snapshot instead of retaining stale prices',()=>{
 const f=fixture();
 f.env.show(full);
 assert.match(visible(f.output.children[0]),/USD 840\.00/);
 f.env.show({
   flights:{status:'no_results',message:'No usable route',offers:[]},
   hotels:{status:'no_results',message:'No usable rooms',offers:[]},
   food:{status:'unavailable',message:'None'},
   transport:{status:'unavailable',message:'None'},note:'Nothing returned'
 });
 assert.equal(f.output.children.length,4);
 assert.match(visible(f.output.children[0]),/Not available/);
 assert.doesNotMatch(visible(f.output),/USD 840\.00|USD 420\.00/);
});

test('comparison snapshot adds no extra API calls or external pricing assumptions',()=>{
 const snippet=source.slice(a,b),css=read('premium-refinement.css');
 assert.doesNotMatch(snippet,/fetch\(|localStorage|SerpApi.api_key|GROQ_API_KEY|Math\.random\(/);
 assert.doesNotMatch(snippet,/\b(?:combined|grandTotal|totalTripPrice)\s*=/);
 assert.match(snippet,/Return flights, taxes, room availability, baggage and transfers/);
 assert.match(css,/\.wf-research-snapshot-facts/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(source,/output\.append\(researchSnapshotPanel\(res\)\)/);
});
