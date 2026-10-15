import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('browser-data.js');
const page=read('data-and-privacy.html');
class Element {
 constructor(){this.listeners={};this.hidden=true;this.disabled=false;this.textContent='';this.focused=false;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 click(){this.listeners.click?.();}
 focus(){this.focused=true;}
}
function fixture({broken=false}={}){
 const keys=new Map([
  ['wf-trips-v2','[{"destination":"Kyoto"}]'],
  ['wf-checks-v2','{"one":true}'],
  ['other-product-key','DO NOT DELETE']
 ]);
 const calls=[],elements=Object.fromEntries(['wf-data-open','wf-data-confirm','wf-data-cancel',
   'wf-data-confirmation','wf-data-result'].map(k=>[k,new Element()]));
 let deletes=0;
 const storage={
  getItem(key){calls.push(['get',key]);if(broken)throw Error('denied');return keys.get(key)??null;},
  removeItem(key){calls.push(['remove',key]);if(broken)throw Error('denied');deletes++;keys.delete(key);},
  clear(){throw Error('storage.clear must never be used');}
 };
 const ctx=vm.createContext({
  document:{getElementById:id=>elements[id]??null},
  localStorage:storage,window:{},console:{log(){throw Error('No personal data logs');}}
 });
 vm.runInContext(app,ctx,{timeout:1000});
 return {elements,keys,calls,ctx,get deletes(){return deletes;}};
}
test('disclosure is accurately linked, keyboard navigable, CSP-safe and avoids fictional legal status',()=>{
 const homepage=read('index.html');
 assert.match(homepage,/href="data-and-privacy\.html"/);
 assert.match(page,/<title>Browser data &amp; privacy \| Wayfarer<\/title>/);
 assert.match(page,/<main id="main">/);
 assert.match(page,/class="skip" href="#main"/);
 assert.match(page,/id="wf-data-open"/);
 assert.match(page,/id="wf-data-confirm"/);
 assert.match(page,/id="wf-data-cancel"/);
 assert.match(page,/id="wf-data-result" role="status" aria-live="polite"/);
 assert.match(page,/Beta information, not finalized legal terms/);
 assert.match(page,/not encrypted, account-synced or confidential/);
 assert.match(page,/operator identity/i);
 assert.match(page,/OpenStreetMap/);
 assert.match(page,/No paid booking checkout/);
 assert.match(page,/src="browser-data\.js" defer/);
 assert.doesNotMatch(page,/<script(?![^>]*src=)[^>]*>/i);
 assert.doesNotMatch(page,/contact@wayfarer|support@wayfarer|privacy@wayfarer/i);
 assert.ok(existsSync(new URL('../browser-data.js',import.meta.url)));
 assert.ok(existsSync(new URL('../browser-data.css',import.meta.url)));
});
test('no browser data read or removed on load; an initial click never deletes drafts',()=>{
 const f=fixture();
 assert.deepEqual(f.calls,[]);
 assert.equal(f.deletes,0);
 f.elements['wf-data-open'].click();
 assert.equal(f.deletes,0);
 assert.equal(f.elements['wf-data-confirmation'].hidden,false);
 assert.equal(f.elements['wf-data-open'].disabled,true);
 assert.equal(f.elements['wf-data-confirm'].focused,true);
 assert.match(f.elements['wf-data-result'].textContent,/Nothing has been deleted/);
 assert.equal(f.keys.get('wf-trips-v2'),'[{"destination":"Kyoto"}]');
});
test('cancel preserves both Wayfarer records and other application data',()=>{
 const f=fixture();
 f.elements['wf-data-open'].click();
 f.elements['wf-data-cancel'].click();
 assert.equal(f.elements['wf-data-confirmation'].hidden,true);
 assert.equal(f.elements['wf-data-open'].disabled,false);
 assert.equal(f.elements['wf-data-open'].focused,true);
 assert.equal(f.deletes,0);
 assert.equal(f.keys.size,3);
 assert.match(f.elements['wf-data-result'].textContent,/Deletion cancelled/);
});
test('explicit confirmation deletes precisely the two Wayfarer local draft keys and verifies removal',()=>{
 const f=fixture();
 f.elements['wf-data-confirm'].click();
 assert.equal(f.deletes,0,'Confirmation cannot run before user arms deletion');
 f.elements['wf-data-open'].click();
 f.elements['wf-data-confirm'].click();
 assert.equal(f.deletes,2);
 assert.equal(f.keys.has('wf-trips-v2'),false);
 assert.equal(f.keys.has('wf-checks-v2'),false);
 assert.equal(f.keys.get('other-product-key'),'DO NOT DELETE');
 assert.deepEqual(f.calls.filter(x=>x[0]==='remove'),[
  ['remove','wf-trips-v2'],['remove','wf-checks-v2']
 ]);
 assert.match(f.elements['wf-data-result'].textContent,/Both Wayfarer local draft/);
 assert.match(f.elements['wf-data-result'].textContent,/other open Wayfarer tabs/);
 assert.equal(f.elements['wf-data-confirmation'].hidden,true);
 assert.equal(f.elements['wf-data-open'].disabled,false);
});
test('storage errors are reported honestly and never claim deletion succeeded',()=>{
 const f=fixture({broken:true});
 f.elements['wf-data-open'].click();
 f.elements['wf-data-confirm'].click();
 assert.equal(f.deletes,0);
 assert.match(f.elements['wf-data-result'].textContent,/Unable to confirm deletion/);
 assert.equal(f.elements['wf-data-confirmation'].hidden,true);
 assert.equal(f.keys.get('wf-trips-v2'),'[{"destination":"Kyoto"}]');
});
test('release decision remains blocked without finalized privacy, operator identity and legal review',()=>{
 const gate=read('scripts/release-readiness.mjs');
 assert.match(gate,/privacy-terms-and-operator-identity/);
 assert.match(gate,/status:'BLOCKED'/);
 assert.match(gate,/productionAuthorization:false/);
 assert.doesNotMatch(app,/localStorage\.clear\(/);
 assert.doesNotMatch(app,/fetch\(|sendBeacon\(|navigator\.clipboard|XMLHttpRequest/);
 const check=JSON.parse(read('package.json')).scripts.check;
 assert.match(check,/node --check browser-data\.js/);
});

test('the additional browser-data release check remains independent of legal approval',()=>{
 const source=read('scripts/release-readiness.mjs');
 assert.match(source,/id:'beta-browser-data-transparency'/);
 assert.match(source,/id:'privacy-terms-and-operator-identity',status:'BLOCKED'/);
 assert.match(source,/productionAuthorization:false/);
 assert.match(read('index.html'),/Browser-local drafts · not encrypted or account-synced/);
 assert.match(read('index.html'),/Review storage and delete local drafts/);
});
