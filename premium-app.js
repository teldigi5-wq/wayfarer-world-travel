const destinations=[{name:'Kyoto',country:'Japan',tag:'Culture & craft',coord:'35.0116° N · 135.7681° E',image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=86',arrival:'https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=1800&q=86',line:'Temple mornings. Lantern-lit evenings.',days:['Higashiyama on foot','Craft, gardens & tea','Nishiki to Gion','Arashiyama before crowds','A quieter northern Kyoto','Design and contemporary art','A day beyond the city'],tip:'Keep voices low on public transport and check photography rules at temples. Sample cultural guidance.'},{name:'Bali',country:'Indonesia',tag:'Nature & ritual',coord:'8.5069° S · 115.2625° E',image:'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=86',arrival:'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=1800&q=86',line:'Island rhythm. Sacred landscapes.',days:['Arrive gently in Ubud','Rice terraces at first light','Water temples and craft','A coastal change of pace','Village kitchens and gardens','Clifftop paths','A final slow morning'],tip:'Dress respectfully at temples, ask before photographing ceremonies, and allow time for road travel. Sample guidance.'},{name:'Switzerland',country:'Switzerland',tag:'Alpine stillness',coord:'46.6863° N · 7.8632° E',image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=86',arrival:'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=1800&q=86',line:'Mountain air. A different perspective.',days:['Lakeside Interlaken','Lauterbrunnen by rail','A high alpine walk','Village cafés and viewpoints','A slow lake day','Bernese Oberland','One last mountain morning'],tip:'Mountain conditions change quickly. Check official forecasts and trail notices. Sample guidance.'}];const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let selected='Kyoto',agentData=null,timer,trips=[],checks={},worldSelection={name:'Kyoto',country:'Japan',countryCode:'JP',latitude:35.0116,longitude:135.7681};try{const saved=JSON.parse(localStorage.getItem('wf-trips-v2')||'[]');trips=Array.isArray(saved)?saved.filter(t=>t&&typeof t==='object'&&!Array.isArray(t)&&typeof t.destination==='string'&&t.destination.trim()&&t.destination.length<120):[]}catch{trips=[]}try{const saved=JSON.parse(localStorage.getItem('wf-checks-v2')||'{}');checks=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}}catch{checks={}}const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{toast('Browser storage unavailable.')}};function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}function view(id){$$('.view').forEach(x=>x.classList.toggle('active',x.id===id));$$('.nav-links button').forEach(x=>{const active=x.dataset.view===id;x.classList.toggle('active',active);if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});if(id==='arrival')arrival();if(id==='trips')renderTrips();scrollTo({top:0,behavior:'instant'})}$$('[data-view]').forEach(b=>b.onclick=e=>{if(b.tagName==='A')e.preventDefault();view(b.dataset.view)});
function renderDest(){ $('#reel').innerHTML=destinations.map(d=>`<button class="destination reveal" data-place="${d.name}"><img loading="lazy" src="${d.image}" alt="${d.name} destination scene"><div class="dest-copy"><span class="eyebrow">${d.country} · ${d.tag}</span><h3>${d.name}</h3><p>${d.line}</p><div class="dest-meta"><span>${d.coord}</span><span>Plan this journey ↗</span></div></div></button>`).join('');$$('[data-place]').forEach(b=>b.onclick=()=>choose(b.dataset.place))}function choose(n){selected=n;const d=destinations.find(x=>x.name===n);worldSelection=d?{name:d.name,country:d.country,countryCode:d.name==='Kyoto'?'JP':d.name==='Bali'?'ID':'CH',latitude:d.name==='Kyoto'?35.0116:d.name==='Bali'?-8.5069:46.6863,longitude:d.name==='Kyoto'?135.7681:d.name==='Bali'?115.2625:7.8632}:worldSelection;$('#destination').value=n;agentData=null;resetAgents();window.WayfarerMap?.selectDestination(worldSelection);nearbyPlaces(worldSelection);build();arrival();view('studio')}let agentRunSerial=0,agentRequestController=null;
const currentResearchBrief=()=>JSON.stringify({
  destination:selected,latitude:worldSelection?.latitude,longitude:worldSelection?.longitude,
  countryCode:worldSelection?.countryCode,days:$('#days')?.value,
  budget:$('#budget')?.value,pace:$('#pace')?.value,
  moods:[...document.querySelectorAll('.pref.on')].map(x=>x.textContent).join(', ')
});
function resetAgents(preserveContext=false){
 agentRunSerial++;
 if(!preserveContext)agentData=null;
 agentRequestController?.abort();
 agentRequestController=null;
 const button=$('#run-agents');if(button){button.disabled=false;button.textContent='Run AI journey ↗';}const cancel=$('#cancel-agents');if(cancel)cancel.hidden=true;
 [['place','Wikipedia context'],['climate','Open-Meteo'],['country','REST Countries']].forEach(([id,label])=>{$('#agent-'+id).className='agent';$('#agent-'+id+' p').textContent='Ready · '+label});$('#agent-ai').className='agent waiting';$('#agent-ai p').textContent='Ready · Groq GPT-OSS 120B';$('#agent-log').classList.remove('open');$('#agent-log').innerHTML='';$('#plan-status').className='micro wait';$('#plan-status').textContent='Sample itinerary';$('#plan-source').textContent='Descriptions and budgets are illustrative. Live tool results appear above with sources.'}
function cancelAgentResearch(){
 if(!agentRequestController)return false;
 // Preserve the existing itinerary provenance if a previous valid draft exists.
 // Cancellation must not relabel an older AI draft as a sample itinerary.
 const status=$('#plan-status'),source=$('#plan-source');
 const savedStatusClass=status.className,savedStatusText=status.textContent,savedSourceText=source.textContent;
 resetAgents(true);
 status.className=savedStatusClass;status.textContent=savedStatusText;source.textContent=savedSourceText;
 $('#agent-ai').className='agent';
 $('#agent-ai p').textContent='Cancelled · no new itinerary applied';
 $('#agent-log').className='agent-log open';
 $('#agent-log').textContent='Research cancelled. Your current itinerary and saved journeys are unchanged. Cancelling the browser request may not cancel any provider processing already started.';
 toast('Research cancelled. Current journey preserved.');
 return true;
}
function build(){$('#studio-target').textContent=selected;const d=destinations.find(x=>x.name===selected),n=Number($('#days').value),budget=Math.max(25,Number($('#budget').value)||180),moods=$$('.pref.on').map(x=>x.textContent).join(' · '),generic=['Arrive and find your bearings','Neighborhoods, culture and local flavor','A slower day beyond the obvious','Architecture, markets and public spaces','Nature at the city edge','Independent exploration','A final unhurried morning'];$('#itinerary-title').textContent=`${n} days in ${selected}`;$('#itinerary').innerHTML=Array.from({length:n},(_,i)=>`<article class="day"><span>DAY 0${i+1} · SAMPLE</span><h3>${d?.days[i]||generic[i]}</h3><p>${$('#pace').value}. ${moods||'Open discovery'}. $${budget}/day working budget—not a live price.</p></article>`).join('')}$$('.pref').forEach(b=>b.onclick=()=>{b.classList.toggle('on');resetAgents();build()});['days','pace'].forEach(x=>$('#'+x).onchange=()=>{resetAgents();build()});$('#budget').oninput=()=>{resetAgents();if($('#budget').checkValidity())build();else{$('#itinerary').replaceChildren();$('#itinerary-title').textContent='Enter a valid daily budget';$('#plan-status').textContent='Budget needs attention';$('#plan-source').textContent='Enter a daily ground budget from USD 25 to USD 2,500 to compose a new sample.'}};$('#budget').onchange=()=>{resetAgents();if($('#budget').checkValidity())build()};$('#compose').onclick=()=>{if(!$('#budget').checkValidity())return $('#budget').reportValidity();resetAgents();build();toast('Sample itinerary recomposed.')};
const esc=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));async function runAgents(){
 if(agentRequestController)return false;
 const serial=++agentRunSerial;
 const controller=new AbortController();agentRequestController=controller;
 const expectedBrief=currentResearchBrief();
 const btn=$('#run-agents');btn.disabled=true;btn.textContent='Agents working…';$('#cancel-agents').hidden=false;['place','climate','country','ai'].forEach(x=>{$('#agent-'+x).className='agent waiting';$('#agent-'+x+' p').textContent=x==='ai'?'Waiting for tool context…':'Calling live source…'});$('#agent-log').className='agent-log open';$('#agent-log').innerHTML='<div>Destination, climate and country research are running in parallel. AI composition starts after the available sources return.</div>';try{const qs=new URLSearchParams({destination:selected,days:$('#days').value,budget:$('#budget').value,pace:$('#pace').value,moods:$$('.pref.on').map(x=>x.textContent).join(', '),lat:worldSelection?.latitude??'',lon:worldSelection?.longitude??'',country:worldSelection?.country??'',countryCode:worldSelection?.countryCode??''});const access=$('#travel-beta-code')?.value?.trim()||'';const r=await fetch('/api/intelligence?'+qs,{headers:access?{'X-Wayfarer-Beta-Token':access}:{},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(26000)])}),d=await r.json();
 if(!r.ok)throw Error(d.error||'Journey unavailable');
 if(serial!==agentRunSerial)return false;
 if(currentResearchBrief()!==expectedBrief){
   $('#agent-log').textContent='Your travel brief changed while research was running. The earlier result was discarded; run research again for the new details.';
   return false;
 }
 agentData=d;[['place','place'],['climate','weather'],['country','country']].forEach(([widget,key])=>{const ok=d[key]?.ok===true;$('#agent-'+widget).className=ok?'agent done':'agent';$('#agent-'+widget+' p').textContent=ok?'Sourced context received':'Source unavailable · continuing with other agents';});$('#agent-ai').className=d.ai?.ok?'agent done':'agent';$('#agent-ai p').textContent=d.ai?.ok?'AI draft created · verify before use':(d.ai?.error||'AI unavailable · local plan retained');const w=d.weather||{},p=d.place||{},c=d.country||{};$('#agent-log').innerHTML=`<div><strong>Climate Agent</strong>${w.ok?`${esc(w.temperature)} °C · wind ${esc(w.wind)} km/h<br><a href="${esc(w.sourceUrl)}" target="_blank">Open-Meteo ↗</a>`:'Unavailable'}</div><div><strong>Destination Agent</strong>${p.ok?`${esc(p.extract)}<br><a href="${esc(p.sourceUrl)}" target="_blank">Wikipedia ↗</a>`:'Unavailable'}</div><div><strong>Country Agent</strong>${c.ok?`${esc(c.currency)} · ${esc(c.language)}<br><a href="${esc(c.sourceUrl)}" target="_blank">REST Countries ↗</a>`:'Unavailable'}</div>`;
if(!c.ok&&c.reference){
 const ref=document.createElement('p');ref.className='wf-country-reference';
 ref.textContent='Bundled country reference · '+c.reference.name+
   (c.reference.capital?' · Capital: '+c.reference.capital:'')+
   (c.reference.region?' · Region: '+c.reference.region:'')+
   '. Live currency, language and timezone details not verified.';
 $('#agent-log').append(ref);
}
if(d.timings){const elapsed=document.createElement('p');elapsed.className='wf-agent-speed';const seconds=x=>(Number(x)/1000).toFixed(1)+'s';elapsed.textContent='Measured research time · public source stage '+seconds(d.timings.publicSourcesMs)+(d.ai?.ok?' · AI composition '+seconds(d.timings.composerMs):' · AI composition unavailable or private');$('#agent-log').append(elapsed);}if(d.verification?.flags?.length){const note=document.createElement('div');note.className='agent-verification';const title=document.createElement('strong');title.textContent='Verification Agent · '+(d.verification.status||'partial');note.append(title);for(const flag of d.verification.flags){const line=document.createElement('p');line.textContent=String(flag);note.append(line)}
const allocation=d.verification.allocationUsd;
if(allocation){const summary=document.createElement('p');summary.className='agent-budget';summary.textContent='Ground budget outline (USD): stays '+allocation.accommodation+', meals '+allocation.food+', local transport '+allocation.localTransport+', activities '+allocation.activities+', contingency '+allocation.contingency+'. Planning allocations only—not verified prices.';note.append(summary)}
if(Array.isArray(d.verification.nextSteps)){
 const heading=document.createElement('strong');heading.textContent='Next research actions';note.append(heading);
 const list=document.createElement('ol');list.className='agent-next-steps';
 for(const next of d.verification.nextSteps){const item=document.createElement('li');item.textContent=String(next.detail||'').slice(0,270);list.append(item)}note.append(list)
}
$('#agent-log').append(note)}if(d.ai?.ok&&Array.isArray(d.ai.days)){const days=d.ai.days;$('#itinerary-title').textContent=d.ai.title;$('#itinerary').innerHTML=days.map((day,i)=>`<article class="day"><span>DAY 0${i+1} · AI DRAFT</span><h3>${esc(day.title)}</h3><p>${esc(day.summary)}</p></article>`).join('');$('#plan-status').className='micro ok';$('#plan-status').textContent='Groq AI itinerary';$('#plan-source').textContent=`AI draft generated by ${d.ai.model}. Tool sources are shown above. Verify venues, hours, availability and prices before travel.`}applyData(d);toast(d.ai?.ok?'Sourced journey briefing and AI draft prepared.':'Available sources retrieved; the sample itinerary is preserved.');return true;
 }catch(e){
   if(serial!==agentRunSerial)return false;
   $('#agent-log').textContent='Research could not complete. Your current itinerary and saved journeys are unchanged. Try again when sources recover.';
   toast(e.name==='AbortError'?'Research timed out.':e.message||'Journey unavailable.');
   return false;
 }finally{
   if(serial===agentRunSerial){
     agentRequestController=null;btn.disabled=false;btn.textContent='Run AI journey ↗';$('#cancel-agents').hidden=true;
   }
 }}$('#run-agents').onclick=runAgents;$('#cancel-agents').onclick=cancelAgentResearch;
$('#save-trip').onclick=()=>{trips=globalThis.WayfarerJourneyIntegrity.upsertJourney(trips,{destination:selected,country:worldSelection?.country||'',worldPlace:worldSelection?.name===selected?{name:worldSelection.name,country:worldSelection.country,countryCode:worldSelection.countryCode,latitude:worldSelection.latitude,longitude:worldSelection.longitude}:null,days:Number($('#days').value),budget:Number($('#budget').value),pace:$('#pace').value,savedAt:new Date().toISOString()});store('wf-trips-v2',trips);toast('Journey saved on this device.')};const arrivalChecklistTrip=()=>({destination:selected,country:worldSelection?.name===selected?worldSelection.country:'',worldPlace:worldSelection?.name===selected?worldSelection:null});function arrival(){const d=destinations.find(x=>x.name===selected),fallback=destinations[0];$('#arrival-image').src=d?.arrival||'wayfarer-hero-v3.jpg';$('#arrival-image').alt='Illustrative travel scene for '+selected;$('#arrival-title').textContent='Welcome to '+selected+'.';const country=worldSelection?.name===selected?worldSelection.country:(d?.country||'');$('#arrival-context-destination').textContent=selected+(country&&country!==selected?', '+country:'');$('#arrival-context-duration').textContent=(Number($('#days').value)||3)+' days';$('#arrival-context-budget').textContent='USD '+((Number($('#days').value)||3)*(Number($('#budget').value)||180)).toLocaleString('en-US',{maximumFractionDigits:0})+' planned';$('#arr-tip').textContent=d?.tip||'Confirm local customs, entry requirements and transport details with official sources before travel.';$$('[data-check]').forEach(c=>c.checked=!!globalThis.WayfarerJourneyIntegrity?.checklistChecked(checks,arrivalChecklistTrip(),c.dataset.check));readiness();if(agentData)applyData(agentData);else{$('#arr-weather').textContent='Run tools';$('#arr-currency').textContent=$('#arr-zone').textContent=$('#arr-language').textContent='—';$('#arr-source').textContent='Tap Refresh to retrieve available weather and country context. Visa rules and transport schedules are not connected.'}}function readiness(){const n=$$('[data-check]').filter(x=>x.checked).length,p=n*25;$('#ring').style.setProperty('--value',p);$('#ring').setAttribute('aria-label',p+'% of preparation checklist complete');$('#ready-value').textContent=p+'%';$('#ready-label').textContent=p===100?'Four personal preparation reminders marked':p>=50?'A few preparation reminders remain':'Start with the essentials'}$$('[data-check]').forEach(c=>c.onchange=()=>{const key=globalThis.WayfarerJourneyIntegrity?.checklistKey(arrivalChecklistTrip(),c.dataset.check);if(key){checks[key]=c.checked;store('wf-checks-v2',checks)}readiness()});function applyData(d){
 const weather=$('#arr-weather'),currency=$('#arr-currency'),zone=$('#arr-zone'),language=$('#arr-language');
 weather.textContent=d.weather?.ok?String(d.weather.temperature)+' °C':'Unavailable';
 currency.textContent=d.country?.ok?(d.country.currencyCode||'Unknown'):'Unavailable';
 zone.textContent=d.country?.ok?(d.country.primaryTimezone||'Unknown'):'Unavailable';
 language.textContent=d.country?.ok?(d.country.primaryLanguage||'Unknown'):'Unavailable';
 const area=$('#arr-source');area.replaceChildren();
 const when=d.retrieved?new Date(d.retrieved):null;
 area.append(document.createTextNode('Retrieved '+(when&&!Number.isNaN(when.valueOf())?when.toLocaleString():'time unknown')+'. '));
 for(const [label,source] of [['Weather source',d.weather?.sourceUrl],['Country source',d.country?.sourceUrl]]){
   try{const url=new URL(source);if(url.protocol!=='https:')continue;
     const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;
     area.append(link,document.createTextNode(' · '));
   }catch{}
 }
 area.append(document.createTextNode('Visa, safety and transport schedules are not connected.'));
}
$('#refresh').onclick=async()=>{view('studio');if(await runAgents())view('arrival')};$('#maps').onclick=()=>{
  if(Number.isFinite(worldSelection?.latitude)&&Number.isFinite(worldSelection?.longitude)){
    view('studio');$('#wf-tab-explore')?.click();
    window.WayfarerMap?.selectDestination(worldSelection);
    window.WayfarerMap?.focusOn({...worldSelection,type:'destination'},true);
    $('#wf-map-studio')?.scrollIntoView({behavior:'instant',block:'start'});
  }else{
    const link='https://www.google.com/maps/search/?api=1&query='+
      encodeURIComponent(selected+(worldSelection?.country?', '+worldSelection.country:''));
    open(link,'_blank','noopener,noreferrer');
  }
};$('#arrival-edit-trip').onclick=()=>view('studio');$('#arrival-journeys-link').onclick=()=>view('trips');$('#arrival-map-secondary').onclick=()=>$('#maps').click();$('#journey-create').onclick=()=>view('studio');$('#download').onclick=()=>{const aiDraft=$('#plan-status').textContent==='Groq AI itinerary';const provenance=aiDraft?'AI-GENERATED DRAFT · VERIFY BEFORE TRAVEL':'ILLUSTRATIVE SAMPLE · NOT LIVE BOOKINGS';const text=`WAYFARER · ${selected}\n\n${provenance}\n${$('#itinerary').innerText}\n\nSOURCE & LIMITATIONS\n${$('#plan-source').textContent}\n\nARRIVAL\n${$('#arr-tip').textContent}\n\nVerify current routes, rules, hours and prices.`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download='wayfarer-'+selected.toLowerCase()+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
function renderTrips(){
 const root=$('#saved'),query=($('#journey-search')?.value||'').trim().toLocaleLowerCase('en');
 const valid=Array.isArray(trips)?trips.filter(t=>t&&typeof t.destination==='string'&&t.destination.length<120):[];
 const items=valid.filter(t=>(t.destination+' '+(t.country||'')).toLocaleLowerCase('en').includes(query));
 const count=$('#journey-count');if(count)count.textContent=valid.length+' '+(valid.length===1?'journey':'journeys');
 root.replaceChildren();
 if(!valid.length||!items.length){
  const empty=document.createElement('div');empty.className='empty';
  const label=document.createElement('span');label.className='eyebrow';label.textContent=valid.length?'NO MATCHES':'YOUR COLLECTION STARTS HERE';
  const heading=document.createElement('h2');heading.textContent=valid.length?'No saved journeys match your search.':'Make room for the remarkable.';
  const p=document.createElement('p');p.textContent=valid.length?'Try another destination or clear the search.':'Choose a destination, shape your own itinerary, and save it privately to this browser.';
  const button=document.createElement('button');button.type='button';button.className='primary';button.textContent=valid.length?'Clear search ↗':'Compose a journey ↗';
  button.onclick=()=>{if(valid.length){$('#journey-search').value='';renderTrips()}else view('studio')};
  empty.append(label,heading,p,button);root.append(empty);return;
 }
 for(const t of [...items].reverse()){
  const d=destinations.find(x=>x.name===t.destination),card=document.createElement('article');card.className='trip';
  const photo=document.createElement('div');photo.className='trip-photo';
  const img=document.createElement('img');img.loading='lazy';img.src=d?.image||'wayfarer-hero-v3.jpg';img.alt=d?'Travel photography of '+d.name:'Illustrative travel landscape';
  const loc=document.createElement('span');loc.className='wf-trip-country';loc.textContent=t.country||d?.country||'YOUR DESTINATION';
  const title=document.createElement('h3');title.textContent=t.destination;photo.append(img,loc,title);
  const body=document.createElement('div');body.className='trip-body';
  const caption=document.createElement('span');caption.className='wf-trip-caption';caption.textContent='SAVED TRAVEL DRAFT';
  const stats=document.createElement('div');stats.className='wf-trip-stats';
  for(const [label,value] of [['DURATION',String(t.days||'—')+' days'],['GROUND PLAN','USD '+(Number(t.days||0)*Number(t.budget||0)).toLocaleString('en-US',{maximumFractionDigits:0})]]){
    const cell=document.createElement('div'),key=document.createElement('span'),amount=document.createElement('strong');key.textContent=label;amount.textContent=value;cell.append(key,amount);stats.append(cell);
  }
  const pace=document.createElement('p');pace.className='wf-trip-pace';pace.textContent='Pace: '+(t.pace||'Balanced')+' · Illustrative planning allocations, not live prices.';
  const actions=document.createElement('div');actions.className='wf-trip-actions';
  const resume=document.createElement('button');resume.type='button';resume.className='wf-trip-action primary';resume.textContent='Continue planning ↗';
  const prepare=document.createElement('button');prepare.type='button';prepare.className='wf-trip-action';prepare.textContent='Arrival plan →';
  const remove=document.createElement('button');remove.type='button';remove.className='wf-trip-action remove';remove.textContent='Remove';
  const resumeTrip=(goToArrival=false)=>{
    // Older saves may predate the current 3/5/7-day and USD 25–2,500 planner.
    // Restore only supported values rather than leaving dropdowns blank.
    const savedDays=Number(t.days),lengths=[3,5,7];
    const days=lengths.reduce((best,n)=>Math.abs(n-savedDays)<Math.abs(best-savedDays)?n:best,3);
    const savedBudget=Number(t.budget),budget=Number.isFinite(savedBudget)&&savedBudget>0?
      Math.max(25,Math.min(2500,savedBudget)):180;
    $('#days').value=String(days);
    $('#budget').value=String(budget);
    const paceMap={'Slow & considered':'Slow & considered','Balanced':'Balanced',
      'Full & energetic':'Full & energetic',slow:'Slow & considered',balanced:'Balanced',
      active:'Full & energetic',Slow:'Slow & considered',Active:'Full & energetic'};
    $('#pace').value=paceMap[t.pace]||'Balanced';
    worldSelection=globalThis.WayfarerJourneyIntegrity?.resolveSavedWorldPlace(t)??null;
    window.WayfarerMap?.selectDestination(worldSelection);
    nearbyPlaces(worldSelection);
    if(!Number.isFinite(worldSelection?.latitude)||!Number.isFinite(worldSelection?.longitude)){
      const info=document.createElement('p');info.className='world-empty';
      info.textContent='Saved destination restored without map coordinates. Search World Explorer and select the matching place before running location-based research.';
      $('#world-results')?.replaceChildren(info);
    }
    selected=t.destination;$('#destination').value=selected;agentData=null;resetAgents();build();arrival();view(goToArrival?'arrival':'studio');
  };
  resume.onclick=()=>resumeTrip();prepare.onclick=()=>resumeTrip(true);
  remove.onclick=()=>{
    if(remove.dataset.confirm!=='yes'){remove.dataset.confirm='yes';remove.textContent='Confirm removal';remove.focus();return;}
    trips=trips.filter(x=>x!==t);store('wf-trips-v2',trips);renderTrips();toast('Journey removed from this browser.');
  };
  remove.addEventListener('blur',()=>{if(remove.isConnected){remove.dataset.confirm='';remove.textContent='Remove'}});
  actions.append(resume,prepare,remove);body.append(caption,stats,pace,actions);card.append(photo,body);root.append(card);
 }
}
$('#journey-search').addEventListener('input',renderTrips);
$('#story-btn').onclick=()=>$('#method').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});const ob=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('in')),{threshold:.1});
const countryCodes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '),countryNames=new Intl.DisplayNames(['en'],{type:'region'});$('#country-filter').innerHTML+=[...countryCodes].sort((a,b)=>countryNames.of(a).localeCompare(countryNames.of(b))).map(code=>'<option value="'+code+'">'+esc(countryNames.of(code))+'</option>').join('');
// Nearby lookup and price matching are isolated to a source-safe, no-metered-call UI module.
async function nearbyPlaces(place){await window.WayfarerNearby?.load(place);}

function selectWorld(place){worldSelection=place;selected=place.name;$('#destination').value=place.name;agentData=null;resetAgents();build();arrival();$$('.world-result').forEach(b=>b.classList.toggle('active',b.dataset.id===String(place.id)));nearbyPlaces(place);toast(place.name+' selected for Journey Studio.')}
const worldHubs=[{"name":"Paris","country":"France","countryCode":"FR","latitude":48.8566,"longitude":2.3522,"airports":[["Charles de Gaulle Airport","CDG"],["Paris Orly Airport","ORY"]]},{"name":"London","country":"United Kingdom","countryCode":"GB","latitude":51.5072,"longitude":-0.1276,"airports":[["London Heathrow Airport","LHR"],["London Gatwick Airport","LGW"]]},{"name":"New York City","country":"United States","countryCode":"US","latitude":40.7128,"longitude":-74.006,"airports":[["John F. Kennedy International Airport","JFK"],["LaGuardia Airport","LGA"],["Newark Liberty International Airport","EWR"]]},{"name":"Tokyo","country":"Japan","countryCode":"JP","latitude":35.6762,"longitude":139.6503,"airports":[["Tokyo Haneda Airport","HND"],["Narita International Airport","NRT"]]},{"name":"Dubai","country":"United Arab Emirates","countryCode":"AE","latitude":25.2048,"longitude":55.2708,"airports":[["Dubai International Airport","DXB"],["Al Maktoum International Airport","DWC"]]},{"name":"Singapore","country":"Singapore","countryCode":"SG","latitude":1.3521,"longitude":103.8198,"airports":[["Singapore Changi Airport","SIN"]]},{"name":"Colombo","country":"Sri Lanka","countryCode":"LK","latitude":6.9271,"longitude":79.8612,"airports":[["Bandaranaike International Airport","CMB"]]},{"name":"Sydney","country":"Australia","countryCode":"AU","latitude":-33.8688,"longitude":151.2093,"airports":[["Sydney Airport","SYD"]]},{"name":"Cape Town","country":"South Africa","countryCode":"ZA","latitude":-33.9249,"longitude":18.4241,"airports":[["Cape Town International Airport","CPT"]]},{"name":"Rio de Janeiro","country":"Brazil","countryCode":"BR","latitude":-22.9068,"longitude":-43.1729,"airports":[["Rio de Janeiro–Galeão Airport","GIG"],["Santos Dumont Airport","SDU"]]},{"name":"Rome","country":"Italy","countryCode":"IT","latitude":41.9028,"longitude":12.4964,"airports":[["Rome Fiumicino Airport","FCO"],["Ciampino Airport","CIA"]]},{"name":"Barcelona","country":"Spain","countryCode":"ES","latitude":41.3874,"longitude":2.1686,"airports":[["Barcelona–El Prat Airport","BCN"]]},{"name":"Bangkok","country":"Thailand","countryCode":"TH","latitude":13.7563,"longitude":100.5018,"airports":[["Suvarnabhumi Airport","BKK"],["Don Mueang International Airport","DMK"]]},{"name":"Seoul","country":"South Korea","countryCode":"KR","latitude":37.5665,"longitude":126.978,"airports":[["Incheon International Airport","ICN"],["Gimpo International Airport","GMP"]]},{"name":"Istanbul","country":"Türkiye","countryCode":"TR","latitude":41.0082,"longitude":28.9784,"airports":[["Istanbul Airport","IST"],["Sabiha Gökçen Airport","SAW"]]},{"name":"Toronto","country":"Canada","countryCode":"CA","latitude":43.6532,"longitude":-79.3832,"airports":[["Toronto Pearson International Airport","YYZ"],["Billy Bishop Toronto City Airport","YTZ"]]},{"name":"Mexico City","country":"Mexico","countryCode":"MX","latitude":19.4326,"longitude":-99.1332,"airports":[["Mexico City International Airport","MEX"],["Felipe Ángeles International Airport","NLU"]]},{"name":"Mumbai","country":"India","countryCode":"IN","latitude":19.076,"longitude":72.8777,"airports":[["Chhatrapati Shivaji Maharaj International Airport","BOM"]]},{"name":"Cairo","country":"Egypt","countryCode":"EG","latitude":30.0444,"longitude":31.2357,"airports":[["Cairo International Airport","CAI"]]},{"name":"Nairobi","country":"Kenya","countryCode":"KE","latitude":-1.2921,"longitude":36.8219,"airports":[["Jomo Kenyatta International Airport","NBO"],["Wilson Airport","WIL"]]},{"name":"Buenos Aires","country":"Argentina","countryCode":"AR","latitude":-34.6037,"longitude":-58.3816,"airports":[["Ministro Pistarini International Airport","EZE"],["Aeroparque Jorge Newbery","AEP"]]},{"name":"Auckland","country":"New Zealand","countryCode":"NZ","latitude":-36.8509,"longitude":174.7645,"airports":[["Auckland Airport","AKL"]]},{"name":"Amsterdam","country":"Netherlands","countryCode":"NL","latitude":52.3676,"longitude":4.9041,"airports":[["Amsterdam Airport Schiphol","AMS"]]},{"name":"Berlin","country":"Germany","countryCode":"DE","latitude":52.52,"longitude":13.405,"airports":[["Berlin Brandenburg Airport","BER"]]}];
const worldSearchCache=new Map();
let activeWorldSearch=null,worldSearchSeq=0;
$('#world-form').onsubmit=async e=>{
 e.preventDefault();
 const q=$('#world-query').value.trim(),cc=$('#country-filter').value;
 if(q.length<2)return;
 const root=$('#world-results'),indicator=$('#world-search-feedback');
 activeWorldSearch?.abort();const ctrl=new AbortController();activeWorldSearch=ctrl;
 const seq=++worldSearchSeq,key=cc+'|'+q.toLocaleLowerCase('en'),cached=worldSearchCache.get(key);
 const show=(items,message)=>{
   if(seq!==worldSearchSeq)return;
   const found=Array.isArray(items)?items:[];
   indicator.textContent=message;
   root.innerHTML=found.length?found.map(x=>
     '<button class="world-result" type="button" data-id="'+esc(x.id||x.name)+'"><b>'+esc(x.name)+'</b><span>'+
     esc([x.admin,x.country].filter(Boolean).join(', '))+'</span></button>').join(''):
     '<p class="world-empty">No sourced destination matched. Check the spelling or choose another country.</p>';
   root.querySelectorAll('.world-result').forEach((button,i)=>button.onclick=()=>selectWorld(found[i]));
 };
 if(cached&&cached.until>Date.now()){show(cached.results,'Showing recent sourced destination results. Choose the matching place.');return;}
 indicator.textContent='Finding real places and coordinates…';
 root.innerHTML='<p class="world-empty wf-world-pending"><span class="wf-search-pulse" aria-hidden="true"></span> Matching the destination to a place index…</p>';
 const timeout=setTimeout(()=>ctrl.abort(),5500);
 try{
   const qs=new URLSearchParams({mode:'search',q,countryCode:cc});
   const response=await fetch('/api/explore?'+qs,{signal:ctrl.signal});
   const payload=await response.json();
   if(!response.ok||!payload.ok)throw Error('Destination lookup unavailable');
   if(seq!==worldSearchSeq)return;
   if(worldSearchCache.size>=36)worldSearchCache.delete(worldSearchCache.keys().next().value);
   worldSearchCache.set(key,{results:payload.results,until:Date.now()+300000});
   show(payload.results,'Sourced places found · choose a result to view airports and stays.');
 }catch(err){
   if(seq!==worldSearchSeq)return;
   const needle=q.toLowerCase();
   const local=worldHubs.filter(x=>(!cc||x.countryCode===cc)&&
     (x.name.toLowerCase().includes(needle)||x.country.toLowerCase().includes(needle))).slice(0,8);
   show(local,local.length?'Public destination search is unavailable. Showing clearly labeled bundled reference places.':
     'The destination index is temporarily unavailable. Try again.');
 }finally{
   clearTimeout(timeout);
   if(activeWorldSearch===ctrl)activeWorldSearch=null;
 }
};
$('#country-filter')?.addEventListener('change',()=>{
 activeWorldSearch?.abort();worldSearchSeq++;
 $('#world-search-feedback').textContent='Country changed. Search for a destination in this country.';
 $('#world-results').replaceChildren();
});


function setStayDates(){const iso=d=>d.toISOString().slice(0,10),start=new Date(),end=new Date();start.setDate(start.getDate()+30);end.setDate(end.getDate()+33);$('#check-in').value=iso(start);$('#check-out').value=iso(end);$('#check-in').min=iso(new Date());$('#check-out').min=iso(new Date(Date.now()+86400000))}
function stayMessage(title,detail,type=''){ $('#stay-results').innerHTML='<article class="stay-empty '+type+'"><b>'+esc(title)+'</b><span>'+esc(detail)+'</span></article>' }
function searchStays(){
 const research=document.getElementById('wayfarer-travel-research');
 if(research){research.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
 const arrival=document.getElementById('travel-arrival');if(arrival&&!arrival.value)arrival.focus({preventScroll:true});}
}
setStayDates();$('#search-stays').onclick=searchStays;
renderDest();$$('.reveal').forEach(x=>ob.observe(x));build();arrival();renderTrips();

