import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../premium-app.js',import.meta.url),'utf8');
const from=app.indexOf('const worldSearchCache=new Map();');
const to=app.indexOf('function localCalendarDate(date){',from);
assert.ok(from>0&&to>from,'real World Explorer handler must remain extractable');
const handler=app.slice(from,to);

function fixture(){
  const nodes=new Map(),pending=[],selections=[];
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{
      id,value:'',textContent:'',innerHTML:'',listeners:{},children:[],attributes:{},
      setAttribute(name,value){this.attributes[name]=value;},
      getAttribute(name){return this.attributes[name];},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      dispatch(type){for(const fn of this.listeners[type]||[])fn();},
      replaceChildren(...items){this.children=items;this.innerHTML='';},
      querySelectorAll(){
        const n=(this.innerHTML.match(/<button class="world-result"/g)||[]).length;
        this.buttons=Array.from({length:n},()=>({onclick:null}));
        return this.buttons;
      }
    });
    return nodes.get(id);
  };
  el('#world-query').value='Paris';el('#country-filter').value='';
  const context=vm.createContext({
    $:el,
    fetch:(url,opts)=>{
      let resolve,reject;
      const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
      pending.push({url:String(url),signal:opts.signal,resolve,reject});
      return promise;
    },
    URLSearchParams,AbortController,Date,setTimeout,clearTimeout,
    esc:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    worldHubs:[
      {id:'paris',name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522},
      {id:'tokyo',name:'Tokyo',country:'Japan',countryCode:'JP',latitude:35.6762,longitude:139.6503}
    ],
    selectWorld:x=>selections.push(x)
  });
  vm.runInContext(handler,context,{timeout:1000});
  const submit=()=>el('#world-form').onsubmit({preventDefault(){}});
  const input=value=>{el('#world-query').value=value;el('#world-query').dispatch('input')};
  const country=value=>{el('#country-filter').value=value;el('#country-filter').dispatch('change')};
  const place=name=>({
    Paris:{id:'paris',name:'Paris',country:'France',countryCode:'FR',latitude:48.8566,longitude:2.3522},
    Tokyo:{id:'tokyo',name:'Tokyo',country:'Japan',countryCode:'JP',latitude:35.6762,longitude:139.6503}
  }[name]);
  const finish=(i,results)=>{
    pending[i].resolve({ok:true,json:async()=>({ok:true,results})});
  };
  return {context,el,pending,selections,submit,input,country,finish,place};
}

test('editing query aborts search, removes old results and rejects a late success even when fetch ignores abort',async()=>{
  const f=fixture(),old=f.submit();
  assert.equal(f.pending.length,1);
  f.input('Tokyo');
  assert.equal(f.pending[0].signal.aborted,true);
  assert.equal(f.el('#world-results').innerHTML,'');
  assert.match(f.el('#world-search-feedback').textContent,/Destination text changed/);
  f.finish(0,[f.place('Paris')]);
  await old;
  assert.doesNotMatch(f.el('#world-results').innerHTML,/Paris/);
  const fresh=f.submit();
  assert.equal(f.pending.length,2);
  assert.match(f.pending[1].url,/q=Tokyo/);
  f.finish(1,[f.place('Tokyo')]);
  await fresh;
  assert.match(f.el('#world-results').innerHTML,/Tokyo/);
  assert.doesNotMatch(f.el('#world-results').innerHTML,/Paris/);
  f.el('#world-results').buttons[0].onclick();
  assert.equal(f.selections.length,1);
  assert.equal(f.selections[0].country,'Japan');
});

test('a short or empty new submission invalidates a previous lookup and does not call the network again',async()=>{
  const f=fixture(),old=f.submit();
  f.el('#world-query').value='P';
  await f.submit();
  assert.equal(f.pending.length,1,'Invalid short query never starts another HTTP request');
  assert.equal(f.pending[0].signal.aborted,true);
  assert.equal(f.el('#world-results').innerHTML,'');
  assert.match(f.el('#world-search-feedback').textContent,/at least two characters/);
  f.finish(0,[f.place('Paris')]);
  await old;
  assert.doesNotMatch(f.el('#world-results').innerHTML,/Paris/);
});

test('country change clears results and prevents cross-country late results',async()=>{
  const f=fixture(),old=f.submit();
  f.country('JP');
  assert.equal(f.pending[0].signal.aborted,true);
  assert.match(f.el('#world-search-feedback').textContent,/Country changed/);
  f.finish(0,[f.place('Paris')]);
  await old;
  assert.doesNotMatch(f.el('#world-results').innerHTML,/Paris/);
  f.input('Tokyo');
  const next=f.submit();
  assert.match(f.pending[1].url,/countryCode=JP/);
  f.finish(1,[f.place('Tokyo')]);await next;
  assert.match(f.el('#world-results').innerHTML,/Tokyo/);
});

test('late rejected request cannot show fallback country hubs for a changed query',async()=>{
  const f=fixture(),old=f.submit();
  f.input('Tokyo');
  f.pending[0].reject(Error('upstream timeout'));
  await old;
  assert.equal(f.el('#world-results').innerHTML,'');
  assert.doesNotMatch(f.el('#world-search-feedback').textContent,/bundled reference places/);
});

test('cache reuses the exact query/country while an edit immediately removes mismatched cached results',async()=>{
  const f=fixture(),first=f.submit();
  f.finish(0,[f.place('Paris')]);await first;
  assert.equal(f.pending.length,1);
  f.input('Par');
  f.input('Paris');
  await f.submit();
  assert.equal(f.pending.length,1,'Exact five-minute public result cache avoids repeat calls');
  assert.match(f.el('#world-results').innerHTML,/Paris/);
  f.input('Tokyo');
  assert.equal(f.el('#world-results').innerHTML,'');
});

test('the deployed source handler invalidates the exact query on input, country and short search',()=>{
  assert.match(handler,/function invalidateWorldSearch\(message\)/);
  assert.match(handler,/activeWorldSearch\?\.abort\(\)/);
  assert.match(handler,/worldSearchSeq\+\+/);
  assert.match(handler,/\$\('#world-query'\)\?\.addEventListener\('input'/);
  assert.match(handler,/if\(q.length<2\)\{\s*invalidateWorldSearch/);
  assert.match(handler,/\$\('#country-filter'\)\?\.addEventListener\('change'/);
  assert.doesNotMatch(handler,/GROQ_API_KEY|SERPAPI_API_KEY|WAYFARER_AI_BETA_TOKEN/);
});

test('public indexed places carry an explicit source label and reject untrusted client coordinates',async()=>{
  const f=fixture(),search=f.submit();
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'true');
  const invalid=[
    {...f.place('Paris'),id:'outside',name:'Outside Earth',latitude:99},
    {...f.place('Paris'),id:'text',name:'Text latitude',latitude:'48.8566'},
    {...f.place('Paris'),id:'bad-country',name:'Invalid country',countryCode:'F'},
    {...f.place('Paris'),id:'bad-longitude',name:'Invalid longitude',longitude:200}
  ];
  f.finish(0,[...invalid,f.place('Paris')]);
  await search;
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'false');
  assert.match(f.el('#world-results').innerHTML,/PUBLIC PLACE INDEX/);
  assert.match(f.el('#world-results').innerHTML,/Paris/);
  for(const corrupt of invalid)
    assert.doesNotMatch(f.el('#world-results').innerHTML,new RegExp(corrupt.name));
  assert.equal(f.el('#world-results').buttons.length,1);
  f.el('#world-results').buttons[0].onclick();
  assert.equal(f.selections.length,1);
  assert.equal(f.selections[0].latitude,48.8566);
});

test('failed worldwide provider with no matching bundled place is an outage, not a verified no-match',async()=>{
  const f=fixture();
  f.el('#world-query').value='Village Not In Bundled Index';
  const search=f.submit();
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'true');
  f.pending[0].reject(Error('provider unavailable'));
  await search;
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'false');
  assert.match(f.el('#world-search-feedback').textContent,/temporarily unavailable/);
  assert.match(f.el('#world-results').innerHTML,/temporarily unavailable/);
  assert.doesNotMatch(f.el('#world-results').innerHTML,/No sourced destination matched/);
  assert.equal(f.selections.length,0);
});

test('offline bundled fallback is visibly distinct from a live geocoded result',async()=>{
  const f=fixture(),search=f.submit();
  f.pending[0].reject(Error('provider unavailable'));
  await search;
  assert.match(f.el('#world-search-feedback').textContent,/bundled place references/);
  assert.match(f.el('#world-results').innerHTML,/BUNDLED PLACE REFERENCE/);
  assert.match(f.el('#world-results').innerHTML,/LIVE SEARCH UNAVAILABLE/);
  assert.equal(f.el('#world-results').buttons.length,1);
  f.el('#world-results').buttons[0].onclick();
  assert.equal(f.selections[0].countryCode,'FR');
  assert.equal(f.selections[0].longitude,2.3522);
});

test('cached public results retain source distinction, while empty matches refresh sooner',async()=>{
  const f=fixture(),first=f.submit();
  f.finish(0,[f.place('Paris')]);await first;
  f.input('Par');f.input('Paris');
  await f.submit();
  assert.equal(f.pending.length,1);
  assert.match(f.el('#world-results').innerHTML,/CACHED PUBLIC LOCATION REFERENCE/);
  f.input('Unknown');
  const search=f.submit();f.finish(1,[]);await search;
  assert.match(f.el('#world-results').innerHTML,/No sourced destination matched/);
  const empty=vm.runInContext("worldSearchCache.get('|unknown')",f.context);
  assert.ok(empty.until-Date.now()<=45000&&empty.until-Date.now()>0,
    'Uncovered place query must not remain falsely absent for five minutes');
});

test('query edits clear the accessible loading state without allowing late provider results',async()=>{
  const f=fixture(),pending=f.submit();
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'true');
  f.input('Tokyo');
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'false');
  f.finish(0,[f.place('Paris')]);await pending;
  assert.equal(f.el('#world-results').getAttribute('aria-busy'),'false');
  assert.doesNotMatch(f.el('#world-results').innerHTML,/PUBLIC PLACE INDEX/);
});
