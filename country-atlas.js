/* Wayfarer Country Atlas · zero paid API searches, plain-text rendering. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const element=(tag,cls,txt)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(txt!==undefined)el.textContent=String(txt);
    return el;
  };
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function nav(view){document.querySelector('.nav-links [data-view="'+view+'"]')?.click();}
  function picture(country,alt){
    const img=element('img');img.src=country.image;img.alt=alt;
    img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>img.remove(),{once:true});return img;
  }
  function official(country){
    const a=element('a','wf-top10-official','Official tourism source ↗');
    a.href=country.source;a.target='_blank';a.rel='noopener noreferrer';return a;
  }
  function studio(country,place){
    nav('studio');
    const select=$('country-filter'),search=$('world-query');
    if(select){select.value=country.code;select.dispatchEvent(new Event('change',{bubbles:true}));}
    if(search){search.value=place;search.focus({preventScroll:true});}
    const results=$('world-results');
    if(results)results.replaceChildren(element('p','world-empty',
      'Search for '+place+', then choose the matching result to add it to your journey.'));
    requestAnimationFrame(()=>$('world-explorer')?.scrollIntoView({
      behavior:reduced()?'instant':'smooth',block:'start'
    }));
  }
  function buildDetail(country){
    const root=$('destinations-page'),panel=$('wf-top10-detail');
    if(!root||!panel)return;
    nav('destinations-page');panel.hidden=false;panel.replaceChildren();
    const top=element('div','wf-top10-detail-hero');
    const visual=element('div','wf-top10-detail-photo');visual.append(picture(country,'Destination landscape from '+country.name));
    const intro=element('div','wf-top10-detail-intro');
    intro.append(element('span','wf-top10-kicker','COUNTRY GUIDE · '+country.region.toUpperCase()),
      element('h2','',country.name),element('p','wf-top10-detail-lead',country.summary),
      element('p','wf-top10-planning','PLAN WITH CONTEXT · '+country.planning));
    const actions=element('div','wf-top10-actions');
    const plan=element('button','wf-top10-primary','Plan a journey ↗');plan.type='button';
    plan.addEventListener('click',()=>studio(country,country.places[0].name));
    actions.append(plan,official(country));intro.append(actions);top.append(visual,intro);panel.append(top);
    const head=element('div','wf-top10-detail-heading');
    head.append(element('span','wf-top10-kicker','PLACES TO VISIT'),
      element('h3','',country.code==='LK'?'Discover Sri Lanka, place by place.':'Where to explore in '+country.name+'.'),
      element('p','',country.places.length+' destination ideas · select a place to continue planning.'));
    panel.append(head);
    const grid=element('div','wf-top10-place-grid');
    for(const [i,place] of country.places.entries()){
      const card=element('article','wf-top10-place-card');
      card.append(element('span','wf-top10-place-index',String(i+1).padStart(2,'0')),
        element('h4','',place.name),element('p','',place.description));
      const button=element('button','wf-top10-place-plan','Plan '+place.name+' ↗');button.type='button';
      button.addEventListener('click',()=>studio(country,place.name));card.append(button);grid.append(card);
    }
    panel.append(grid,element('p','wf-top10-small',
      'Editorial travel ideas only. Verify opening times, entry requirements, local transport and supplier availability before travel. No prices or reservations are implied.'));
    panel.focus({preventScroll:true});
    panel.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});
  }
  function buildView(countries){
    const root=$('destinations-page'),target=root?.querySelector('.wf-ed-container');
    if(!root||!target||$('wf-top10-detail'))return;
    const panel=element('section','wf-top10-detail');panel.id='wf-top10-detail';
    panel.setAttribute('aria-label','Country guide and attractions');
    panel.tabIndex=-1;panel.hidden=true;root.insertBefore(panel,target);
  }
  function buildHome(countries){
    const anchor=$('destinations');
    if(!anchor||$('wf-top10-atlas'))return;
    const section=element('section','wf-top10-atlas');section.id='wf-top10-atlas';
    section.setAttribute('aria-labelledby','wf-top10-heading');
    section.innerHTML=
      '<div class="wf-top10-header"><div><span class="wf-top10-kicker">THE WORLD / CURATED PLACES</span>'+
      '<h2 id="wf-top10-heading">Ten countries. <em>More to discover.</em></h2>'+
      '<p>Explore remarkable places across the world and get practical details before you plan. An editorial selection, not a global statistical ranking.</p></div>'+
      '<label for="wf-top10-filter" class="wf-top10-search">FIND A COUNTRY OR PLACE'+
      '<input id="wf-top10-filter" type="search" maxlength="100" autocomplete="off" placeholder="Sri Lanka, Kyoto, Sigiriya…"></label></div>'+
      '<div class="wf-top10-layout"><div class="wf-top10-main">'+
      '<div class="wf-top10-grid-label"><h3>Places worth exploring</h3><span id="wf-top10-count" role="status" aria-live="polite"></span></div>'+
      '<div id="wf-top10-grid" class="wf-top10-grid"></div></div>'+
      '<aside class="wf-top10-sri-lanka" aria-labelledby="wf-top10-sri-title">'+
      '<div id="wf-top10-sri-image" class="wf-top10-sri-photo"></div>'+
      '<div class="wf-top10-sri-copy"><span class="wf-top10-kicker">SPOTLIGHT / SRI LANKA</span>'+
      '<h3 id="wf-top10-sri-title">One island. Many stories.</h3>'+
      '<p>From the ancient rock fortress at Sigiriya to tea country, historic Galle and the southern coast.</p>'+
      '<span class="wf-top10-sri-small">PLACES TO START</span>'+
      '<div class="wf-top10-sri-tags"><span>Sigiriya</span><span>Ella</span><span>Galle Fort</span><span>Nuwara Eliya</span><span>Mirissa</span></div>'+
      '<button type="button" id="wf-top10-sri-open">Explore Sri Lanka ↗</button>'+
      '<small>Source-led destination inspiration. Confirm travel details with operators.</small></div></aside></div>'+
      '<div class="wf-top10-footer"><p>Looking beyond these ten countries? Explore the wider country directory and search for a city.</p>'+
      '<button type="button" id="wf-top10-all">Browse worldwide ↗</button></div>';
    anchor.insertAdjacentElement('beforebegin',section);
    const sri=countries.find(c=>c.code==='LK');
    if(sri){
      $('wf-top10-sri-image').append(picture(sri,'Sigiriya Rock Fortress, Sri Lanka'));
      $('wf-top10-sri-open').addEventListener('click',()=>buildDetail(sri));
    }
    function render(){
      const q=$('wf-top10-filter').value.toLocaleLowerCase().trim();
      const filtered=countries.filter(country=>
        (country.name+' '+country.shortName+' '+country.mood+' '+
         country.places.map(p=>p.name).join(' ')).toLocaleLowerCase().includes(q));
      const grid=$('wf-top10-grid');grid.replaceChildren();
      for(const country of filtered){
        const item=element('article','wf-top10-item');
        const button=element('button','wf-top10-card');button.type='button';
        button.setAttribute('aria-label','Explore places to visit in '+country.name);
        const pictureBox=element('div','wf-top10-card-photo');pictureBox.append(picture(country,'Scenic travel photo for '+country.name));
        pictureBox.append(element('span','wf-top10-number',String(country.id).padStart(2,'0')));
        const copy=element('div','wf-top10-card-copy');
        copy.append(element('h4','',country.shortName),element('p','',country.places.slice(0,3).map(p=>p.name).join(' · ')));
        button.append(pictureBox,copy);button.addEventListener('click',()=>buildDetail(country));item.append(button);grid.append(item);
      }
      $('wf-top10-count').textContent=filtered.length+' of '+countries.length+' editorial picks';
      if(!filtered.length)grid.append(element('p','wf-top10-no-results','No matching country in this collection. Try another name or browse worldwide.'));
    }
    $('wf-top10-filter').addEventListener('input',render);
    $('wf-top10-all').addEventListener('click',()=>{
      nav('discover');requestAnimationFrame(()=>$('wf-world-atlas')?.scrollIntoView({
        behavior:reduced()?'instant':'smooth',block:'start'}));
    });
    render();
  }
  async function init(){
    try{
      const res=await fetch('country-atlas.json',{cache:'force-cache'});
      if(!res.ok)throw Error('Country collection unavailable');
      const payload=await res.json();
      const countries=Array.isArray(payload.countries)?payload.countries:[];
      if(countries.length!==10||countries.some(c=>!Array.isArray(c.places)||c.places.length<4))
        throw Error('Country collection incomplete');
      buildView(countries);buildHome(countries);
      if(location.hash==='#sri-lanka'){
        const sri=countries.find(c=>c.code==='LK');if(sri)buildDetail(sri);
      }
    }catch{
      const anchor=$('destinations');
      if(anchor){
        const note=element('p','wf-top10-no-results','The featured country collection could not load. Destination discovery and Journey Studio remain available.');
        anchor.insertAdjacentElement('beforebegin',note);
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();