/* Wayfarer Destinations + Guides: purposeful editorial discovery, never invented bookings. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const places=$('destinations-page'), guides=$('guides-page');
if(!places||!guides||$('wf-destination-list'))return;
const destinations=[
{id:'kyoto',name:'Kyoto',country:'Japan',code:'JP',region:'Asia',style:'Culture',search:'Kyoto',curated:'Kyoto',season:'Spring or autumn',slogan:'Temples, gardens and traditional craft',intro:'Historic neighborhoods, craft and everyday culture. Check site opening hours and local access.',image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=82',source:'https://www.japan.travel/en/'},
{id:'amalfi',name:'Amalfi Coast',country:'Italy',code:'IT',region:'Europe',style:'Coast',search:'Amalfi',season:'Spring or early autumn',slogan:'Cliffside towns and Mediterranean views',intro:'Explore the coastal villages, taking ferry schedules, travel times and weather into account.',image:'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1000&q=82',source:'https://www.italia.it/en'},
{id:'lofoten',name:'Lofoten',country:'Norway',code:'NO',region:'Europe',style:'Nature',search:'Svolvær',season:'Season dependent',slogan:'Arctic islands, fjords and mountain scenery',intro:'Plan around daylight, seasonal conditions and transport; never assume clear skies.',image:'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1000&q=82',source:'https://www.visitnorway.com/en/'},
{id:'iceland',name:'Iceland',country:'Iceland',code:'IS',region:'Europe',style:'Nature',search:'Reykjavík',season:'Season dependent',slogan:'Waterfalls, volcanic scenery and open landscapes',intro:'Build comfortable driving days and check official road and weather updates.',image:'https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&fit=crop&w=1000&q=82',source:'https://www.visiticeland.com/'},
{id:'bali',name:'Bali',country:'Indonesia',code:'ID',region:'Asia',style:'Culture',search:'Ubud',curated:'Bali',season:'Season dependent',slogan:'Temple traditions, village life and tropical landscapes',intro:'Respect ceremonies, follow dress guidance and allow time for road travel.',image:'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=82',source:'https://www.indonesia.travel/my/en/'},
{id:'alps',name:'Swiss Alps',country:'Switzerland',code:'CH',region:'Europe',style:'Nature',search:'Interlaken',curated:'Switzerland',season:'Season dependent',slogan:'Lakes, mountain rail and alpine valleys',intro:'Check trail notices, rail/lift timetables and mountain weather before traveling.',image:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=82',source:'https://www.myswitzerland.com/en/destinations/'}
,{id:'sri-lanka',name:'Sri Lanka',country:'Sri Lanka',code:'LK',region:'Asia',style:'Culture',search:'Sigiriya',season:'Season and region dependent',slogan:'Ancient heritage, green hills and coastal towns',intro:'Explore Sigiriya, the Cultural Triangle, Ella and the southern coast at a practical pace.',image:'https://images.unsplash.com/photo-1612862862126-865765df2ded?auto=format&fit=crop&w=1000&q=82',source:'https://www.srilanka.travel/'}
];
const guideList=[
{id:'japan',dest:0,type:'Planning',title:'Japan: first-trip essentials',intro:'An approachable route through daily pacing, transport and arrival.',points:['Choose a small number of bases to reduce transfers.','Check official transport and airport-access information.','Verify entry requirements with the relevant government before travel.']},
{id:'kyoto',dest:0,type:'Culture',title:'Kyoto: explore with care',intro:'Temples, craft and thoughtful neighborhood walks.',points:['Keep walking days focused on nearby neighborhoods.','Confirm individual site hours and photography rules.','Respect residents and places of worship.']},
{id:'italy',dest:1,type:'Planning',title:'Amalfi Coast: choosing a base',intro:'A practical way to plan coastal stays and connections.',points:['Compare bases for access and walking requirements.','Confirm ferry and road connections for your dates.','Treat early budget figures as estimates, not supplier prices.']},
{id:'iceland',dest:3,type:'Arrival',title:'Iceland: your first day',intro:'Arrival logistics and sensible first-day road planning.',points:['Check current weather and road advisories.','Confirm airport transfer to your first hotel.','Plan rest breaks and seasonal daylight before long drives.']},
{id:'norway',dest:2,type:'Nature',title:'Lofoten: think seasonally',intro:'Plan for changing weather and daylight rather than perfect conditions.',points:['Check roads, boats and local forecasts.','Allow flexibility for outdoor plans.','Never assume a natural phenomenon will occur on a specific day.']},
{id:'bali',dest:4,type:'Culture',title:'Bali: local etiquette',intro:'Travel sensitively around temples and village communities.',points:['Follow posted dress rules at religious places.','Ask permission before photographing people or ceremonies.','Build realistic time into trips between areas.']}
,{id:'sri-lanka-first',dest:6,type:'Planning',title:'Sri Lanka: how to plan your first visit',intro:'Find a sensible rhythm between the Cultural Triangle, tea country and coast.',points:['Start with a few bases to reduce long transfers.','Research Sigiriya, Ella and Galle Fort through Sri Lanka Tourism and official heritage resources.','Check travel advisories, entry rules, weather and operator arrangements before booking.']},
{id:'sri-lanka-heritage',dest:6,type:'Culture',title:'Sigiriya, Kandy and Galle: heritage routes',intro:'An introduction to Sri Lanka’s historic sites and respectful visitor practices.',points:['Consider the Cultural Triangle before the hill country or coast.','Observe temple dress and photography requirements and respect religious practices.','Check official opening times, admission arrangements and route accessibility.']}
];
const node=(tag,cls,value)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);
 return n;
};
function img(src,name){
 const n=node('img');n.src=src;n.alt='Editorial travel photo: '+name;n.loading='lazy';n.decoding='async';
 n.addEventListener('error',()=>n.remove(),{once:true});return n;
}
const changeTab=id=>document.querySelector('.nav-links [data-view="'+id+'"]')?.click();
function begin(destination){
 const shortcut=[...document.querySelectorAll('#reel [data-place]')]
   .find(el=>el.dataset.place===destination.curated);
 if(shortcut){shortcut.click();return}
 changeTab('studio');
 // Search handoff must open the Studio Destinations panel, not its hidden Overview.
 $('wf-tab-explore')?.click();
 const country=$('country-filter'),query=$('world-query');
 if(country){country.value=destination.code;country.dispatchEvent(new Event('change',{bubbles:true}));}
 if(query){query.value=destination.search;query.focus({preventScroll:true});}
 const root=$('world-results');
 if(root)root.replaceChildren(node('p','world-empty','Search for '+destination.search+
   ', then select the correct result to connect it to your itinerary.'));
 requestAnimationFrame(()=>$('world-explorer')?.scrollIntoView({
  behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'
 }));
}
places.innerHTML=
 '<header class="wf-ed-hero wf-ed-dest-hero"><div class="wf-ed-hero-copy">'+
 '<span class="wf-ed-kicker">WAYFARER / DESTINATIONS</span>'+
 '<h1>Places to go. <em>Reasons to stay.</em></h1>'+
 '<p>Discover remarkable places, with useful context and a clear path from inspiration to a practical plan.</p>'+
 '<button id="wf-dest-browse" class="wf-ed-primary" type="button">Explore destinations ↗</button></div>'+
 '<div class="wf-ed-hero-note"><span>01 / DISCOVER</span><strong>Find somewhere meaningful.</strong></div></header>'+
 '<div class="wf-ed-container"><section class="wf-ed-featured" aria-label="Featured destination">'+
 '<div id="wf-ed-featured-photo" class="wf-ed-featured-photo"></div><div class="wf-ed-featured-copy">'+
 '<span class="wf-ed-kicker">FEATURED / JAPAN</span><h2>Kyoto, in your own time.</h2>'+
 '<p>Temples, gardens and daily life. Build a comfortable itinerary instead of trying to fit everything into one day.</p>'+
 '<div class="wf-ed-featured-facts"><span>Culture & craft</span><span>Walkable neighborhood days</span></div>'+
 '<button id="wf-featured-begin" class="wf-ed-primary" type="button">Plan Kyoto ↗</button>'+
 '<a target="_blank" rel="noopener noreferrer" href="https://www.japan.travel/en/">Official Japan travel guide ↗</a></div></section>'+
 '<section class="wf-ed-library" id="wf-dest-library" aria-labelledby="wf-dest-title">'+
 '<div class="wf-ed-section-head"><div><span class="wf-ed-kicker">CURATED STARTING POINTS</span>'+
 '<h2 id="wf-dest-title">Where will you go?</h2></div><p id="wf-dest-count" role="status" aria-live="polite"></p></div>'+
 '<div class="wf-ed-filters"><label>Search<input id="wf-dest-query" type="search" placeholder="City or country…" maxlength="80"></label>'+
 '<label>Region<select id="wf-dest-region"><option value="all">All regions</option><option>Asia</option><option>Europe</option></select></label>'+
 '<label>Travel mood<select id="wf-dest-style"><option value="all">All styles</option><option>Culture</option><option>Nature</option><option>Coast</option></select></label>'+
 '<button type="button" id="wf-dest-reset">Reset</button></div>'+
 '<div id="wf-destination-list" class="wf-ed-dest-grid"></div>'+
 '<div class="wf-ed-directory"><div><span class="wf-ed-kicker">MORE OF THE WORLD</span><h3>Explore beyond the collection.</h3>'+
 '<p>The country directory covers many places, but flight, hotel and local data coverage varies.</p></div>'+
 '<button id="wf-directory-open" type="button">Browse all countries ↗</button></div></section></div>';
guides.innerHTML=
 '<header class="wf-ed-hero wf-ed-guides-hero"><div class="wf-ed-hero-copy">'+
 '<span class="wf-ed-kicker">WAYFARER / TRAVEL GUIDES</span>'+
 '<h1>Good journeys begin <em>informed.</em></h1>'+
 '<p>Clear planning notes with official tourism references. Get oriented, stay curious and verify what matters.</p>'+
 '<button id="wf-guides-browse" class="wf-ed-primary" type="button">Explore travel guides ↗</button></div>'+
 '<div class="wf-ed-hero-note"><span>02 / PREPARE</span><strong>Travel with more confidence.</strong></div></header>'+
 '<div class="wf-ed-container"><div class="wf-ed-guide-layout"><section class="wf-ed-guides-library" id="wf-guides-library" aria-labelledby="wf-guides-title">'+
 '<div class="wf-ed-section-head"><div><span class="wf-ed-kicker">THE TRAVEL READING ROOM</span><h2 id="wf-guides-title">Practical destination guides.</h2></div>'+
 '<p id="wf-guides-count" role="status" aria-live="polite"></p></div>'+
 '<label class="wf-ed-guide-search">Search guides<input id="wf-guides-search" type="search" placeholder="Topic or country…" maxlength="80"></label>'+
 '<div class="wf-ed-guide-topics" role="group" aria-label="Guide categories" id="wf-guides-topics">'+
 '<button data-topic="all" type="button" aria-pressed="true">All guides</button>'+
 '<button data-topic="Planning" type="button" aria-pressed="false">Planning</button>'+
 '<button data-topic="Culture" type="button" aria-pressed="false">Culture</button>'+
 '<button data-topic="Arrival" type="button" aria-pressed="false">Arrival</button>'+
 '<button data-topic="Nature" type="button" aria-pressed="false">Nature</button></div>'+
 '<div id="wf-guide-cards" class="wf-ed-guides-grid"></div>'+
 '<article id="wf-guide-detail" class="wf-ed-reader" tabindex="-1" aria-labelledby="wf-reader-title" hidden></article></section>'+
 '<aside class="wf-ed-guide-aside" aria-labelledby="wf-guide-aside-title">'+
 '<span class="wf-ed-kicker">BEFORE YOUR DEPARTURE</span><h3 id="wf-guide-aside-title">What to check.</h3>'+
 '<div><strong>Entry & documents</strong><p>Rules vary by nationality and purpose. Consult official immigration sources.</p></div>'+
 '<div><strong>Transport</strong><p>Confirm actual flight, rail and local operator schedules.</p></div>'+
 '<div><strong>Money & connectivity</strong><p>Research payment methods, roaming and access to local currency.</p></div>'+
 '<div><strong>Health & safety</strong><p>Check government travel advisories and emergency contacts.</p></div>'+
 '<button id="wf-guide-arrival" type="button">Open Arrival Companion ↗</button>'+
 '<small>Editorial planning starters only—not government advice, expert certification or verified live travel status.</small></aside></div></div>';
$('wf-ed-featured-photo').append(img(destinations[0].image,'Kyoto'));
$('wf-featured-begin').addEventListener('click',()=>begin(destinations[0]));
$('wf-dest-browse').addEventListener('click',()=>$('wf-dest-library').scrollIntoView({block:'start',behavior:'smooth'}));
$('wf-guides-browse').addEventListener('click',()=>$('wf-guides-library').scrollIntoView({block:'start',behavior:'smooth'}));
$('wf-guide-arrival').addEventListener('click',()=>changeTab('arrival'));
$('wf-directory-open').addEventListener('click',()=>{
 changeTab('discover');
 requestAnimationFrame(()=>$('wf-world-atlas')?.scrollIntoView({block:'start',behavior:'smooth'}));
});
function renderDestinations(){
 const q=$('wf-dest-query').value.toLocaleLowerCase().trim();
 const region=$('wf-dest-region').value,style=$('wf-dest-style').value;
 const filtered=destinations.filter(d=>(region==='all'||d.region===region)&&
 (style==='all'||d.style===style)&&(!q||(d.name+' '+d.country+' '+d.slogan).toLocaleLowerCase().includes(q)));
 const container=$('wf-destination-list');container.replaceChildren();
 for(const d of filtered){
  const article=node('article','wf-ed-dest-card'),picture=node('div','wf-ed-dest-photo');
  picture.append(img(d.image,d.name));const caption=node('div','wf-ed-dest-caption');
  caption.append(node('span','wf-ed-kicker',d.country.toUpperCase()),node('h3','',d.name));picture.append(caption);
  const body=node('div','wf-ed-dest-body');
  body.append(node('p','',d.slogan));
  const facts=node('div','wf-ed-dest-facts');
  facts.append(node('span','',d.style+' travel'),node('span','',d.season+' · seasonal suggestion'));
  body.append(facts);
  const actions=node('div','wf-ed-card-actions');
  const btn=node('button','wf-ed-card-action','Plan this place ↗');btn.type='button';
  btn.addEventListener('click',()=>begin(d));
  const link=node('a','','Official tourism source ↗');link.href=d.source;link.target='_blank';link.rel='noopener noreferrer';
  actions.append(btn,link);body.append(actions);article.append(picture,body);container.append(article);
 }
 if(!filtered.length)container.append(node('p','wf-ed-empty','No matches. Try another region, travel style or search.'));
 $('wf-dest-count').textContent=filtered.length+' curated destinations · not live availability';
}
for(const id of ['wf-dest-query','wf-dest-region','wf-dest-style']){
 $(id).addEventListener(id==='wf-dest-query'?'input':'change',renderDestinations);
}
$('wf-dest-reset').addEventListener('click',()=>{
 $('wf-dest-query').value='';$('wf-dest-region').value='all';$('wf-dest-style').value='all';
 renderDestinations();$('wf-dest-query').focus();
});
let currentTopic='all';
function openGuide(g){
 const dest=destinations[g.dest],reader=$('wf-guide-detail');reader.replaceChildren();
 const back=node('button','wf-ed-back','← Back to guides');back.type='button';
 back.addEventListener('click',()=>{reader.hidden=true;$('wf-guides-title').scrollIntoView({block:'start'});});
 reader.append(back,node('span','wf-ed-kicker',dest.country+' / '+g.type));
 const title=node('h2','',g.title);title.id='wf-reader-title';reader.append(title,node('p','',g.intro),
  node('h3','','Things to check before you go'));
 const list=node('ul');for(const point of g.points)list.append(node('li','',point));reader.append(list);
 reader.append(node('p','wf-ed-disclaimer','These are planning prompts. Verify official information and current supplier details before making travel decisions.'));
 const a=node('a','wf-ed-reader-source','Open the official tourism website ↗');
 a.href=dest.source;a.target='_blank';a.rel='noopener noreferrer';reader.append(a);
 const plan=node('button','wf-ed-primary','Plan a journey ↗');plan.type='button';
 plan.addEventListener('click',()=>begin(dest));reader.append(plan);
 reader.hidden=false;reader.focus({preventScroll:true});
 reader.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function renderGuides(){
 const q=$('wf-guides-search').value.toLocaleLowerCase().trim();
 const filtered=guideList.filter(g=>(currentTopic==='all'||g.type===currentTopic)&&
 (!q||(g.title+' '+g.intro+' '+destinations[g.dest].country).toLocaleLowerCase().includes(q)));
 const container=$('wf-guide-cards');container.replaceChildren();
 for(const g of filtered){
  const dest=destinations[g.dest],article=node('article','wf-ed-guide-card');
  const visual=node('div','wf-ed-guide-photo');visual.append(img(dest.image,dest.name));
  const body=node('div','wf-ed-guide-body');
  body.append(node('span','wf-ed-kicker',dest.country+' · '+g.type),node('h3','',g.title),
    node('p','',g.intro));
  const btn=node('button','wf-ed-guide-open','Read this guide ↗');btn.type='button';
  btn.addEventListener('click',()=>openGuide(g));body.append(btn);
  article.append(visual,body);container.append(article);
 }
 if(!filtered.length)container.append(node('p','wf-ed-empty','No matching guides. Try another topic.'));
 $('wf-guides-count').textContent=filtered.length+' guides · editorial starters';
}
$('wf-guides-search').addEventListener('input',renderGuides);
for(const b of document.querySelectorAll('#wf-guides-topics button')){
 b.addEventListener('click',()=>{
  currentTopic=b.dataset.topic;
  for(const x of document.querySelectorAll('#wf-guides-topics button'))x.setAttribute('aria-pressed',String(x===b));
  $('wf-guide-detail').hidden=true;renderGuides();
 });
}
renderDestinations();renderGuides();
})();
