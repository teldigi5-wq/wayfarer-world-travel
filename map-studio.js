/* Wayfarer Map Studio — optional, user-initiated interactive geographic context.
   No background tiles, no Google Maps API key, no paid route or provider calls. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const section=$('wf-map-studio'),viewport=$('wf-map-viewport'),pins=$('wf-map-pins');
  if(!section||!viewport||!pins)return;
  const label=$('wf-map-title'),status=$('wf-map-status'),osm=$('wf-map-osm-link');
  const google=$('wf-map-google-link'),directions=$('wf-map-directions-link');
  const launch=$('wf-map-launch'),hide=$('wf-map-hide'),mode=$('wf-map-scope');
  const valid=(lat,lon)=>typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90&&
    typeof lon==='number'&&Number.isFinite(lon)&&Math.abs(lon)<=180;
  const bounds=(lat,lon,span)=>{
    // Preserve geographic scale at high latitudes and a usable bbox width
    // near the poles and International Date Line. OSM's embedded map cannot
    // cross the ±180 seam in one bbox: shift a valid local window instead of
    // truncating it to an almost-zero-width strip.
    if(!valid(lat,lon))return null;
    const radius=span==='region'?.42:.075;
    const latitudeSpan=Math.min(180,radius*2);
    const longitudeRadius=Math.min(25,radius/Math.max(.08,Math.cos(lat*Math.PI/180)));
    const longitudeSpan=longitudeRadius*2;
    const south=Math.max(-90,Math.min(lat-radius,90-latitudeSpan));
    const west=Math.max(-180,Math.min(lon-longitudeRadius,180-longitudeSpan));
    return [west,south,west+longitudeSpan,south+latitudeSpan]
      .map(x=>Number(x.toFixed(6))).join(',');
  };
  function links(point){
    const lat=point.latitude,lon=point.longitude;
    const q=lat.toFixed(5)+','+lon.toFixed(5);
    const osmUrl=new URL('https://www.openstreetmap.org/');
    osmUrl.searchParams.set('mlat',String(lat));
    osmUrl.searchParams.set('mlon',String(lon));
    osmUrl.hash='map=12/'+lat.toFixed(5)+'/'+lon.toFixed(5);
    osm.href=osmUrl.href;
    const googleUrl=new URL('https://www.google.com/maps/search/');
    googleUrl.searchParams.set('api','1');googleUrl.searchParams.set('query',q);
    google.href=googleUrl.href;
    const routeUrl=new URL('https://www.google.com/maps/dir/');
    routeUrl.searchParams.set('api','1');routeUrl.searchParams.set('destination',q);
    directions.href=routeUrl.href;
  }
  // Named mapped locations are not globally unique. Coordinates and type are
  // part of the pin identity, not just a display label or array position.
  const pinKey=item=>item&&valid(item.latitude,item.longitude)?
    [item.type||'destination',String(item.name||'Mapped place').slice(0,120),
     item.latitude.toFixed(5),item.longitude.toFixed(5)].join(':'):null;
  let focus=null,chosen=null,locations={airports:[],hotels:[]},initialized=false;
  function placeholder(message){
    viewport.replaceChildren();
    const panel=document.createElement('div');panel.className='wf-map-standby';
    const eyebrow=document.createElement('span');eyebrow.textContent='WORLD / LOCATION INTELLIGENCE';
    const heading=document.createElement('strong');heading.textContent='A sense of place.';
    const note=document.createElement('p');note.textContent=message;
    panel.append(eyebrow,heading,note);
    viewport.append(panel);
    initialized=false;hide.hidden=true;launch.hidden=false;
  }
  function iframe(){
    if(!focus||!valid(focus.latitude,focus.longitude))return;
    const src=new URL('https://www.openstreetmap.org/export/embed.html');
    src.searchParams.set('bbox',bounds(focus.latitude,focus.longitude,mode.value));
    src.searchParams.set('layer','mapnik');
    src.searchParams.set('marker',focus.latitude.toFixed(6)+','+focus.longitude.toFixed(6));
    const frame=document.createElement('iframe');
    frame.className='wf-map-frame';
    frame.title='OpenStreetMap interactive map centered on '+focus.name;
    frame.loading='lazy';frame.referrerPolicy='no-referrer';
    // Third-party OSM remains opt-in and isolated from first-party storage.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups');
    frame.src=src.href;
    viewport.replaceChildren(frame);
    status.textContent='Interactive OpenStreetMap centered on '+focus.name+
      '. Mapped locations are reference points, not verified driving routes.';
    initialized=true;hide.hidden=false;launch.hidden=true;
  }
  function focusOn(item,open=false){
    if(!valid(item?.latitude,item?.longitude))return false;
    focus={name:String(item.name||'Mapped place').slice(0,120),
      latitude:item.latitude,longitude:item.longitude,key:pinKey(item)};
    label.textContent=focus.name;links(focus);
    // Keep the optional globe pointed at the same verified map coordinate;
    // this performs no imagery request while Earth is closed.
    window.WayfarerGlobe?.centerOn(item);
    pins.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',
      b.dataset.place===focus.key?'true':'false'));
    if(open||initialized)iframe();
    else status.textContent='Map ready for '+focus.name+'. Select Open interactive map to load map imagery.';
    return true;
  }
  function renderPins(){
    pins.replaceChildren();
    const known=new Set();
    const entries=[...(chosen?[{...chosen,type:'destination'}]:[]),
      ...locations.airports.slice(0,5).map(x=>({...x,type:'airport'})),
      ...locations.hotels.slice(0,5).map(x=>({...x,type:'hotel'}))];
    const duplicates=new Map();
    for(const entry of entries){
      if(!valid(entry.latitude,entry.longitude))continue;
      const name=String(entry.name||'Mapped place');
      duplicates.set(name,(duplicates.get(name)||0)+1);
    }
    for(const entry of entries){
      if(!valid(entry.latitude,entry.longitude))continue;
      const key=pinKey(entry);
      if(known.has(key))continue;
      known.add(key);
      const button=document.createElement('button');button.type='button';
      button.className='wf-map-pin';
      button.dataset.place=key;
      button.setAttribute('aria-pressed',String(focus?.key===key));
      const icon=document.createElement('span');icon.className='wf-map-dot';
      const text=document.createElement('span');
      const name=document.createElement('strong');name.textContent=entry.name;
      const kind=document.createElement('small');
      const category=entry.type==='airport'?'Airport reference':
        entry.type==='hotel'?'Mapped hotel reference':'Chosen destination';
      const coordinate=entry.latitude.toFixed(5)+', '+entry.longitude.toFixed(5);
      kind.textContent=category+(duplicates.get(String(entry.name||'Mapped place'))>1?
        ' · '+coordinate:'');
      button.setAttribute('aria-label',String(entry.name||'Mapped place')+' · '+category+
        (duplicates.get(String(entry.name||'Mapped place'))>1?' · '+coordinate:''));
      text.append(name,kind);button.append(icon,text);
      button.addEventListener('click',()=>focusOn(entry,true));
      pins.append(button);
    }
  }
  function selectDestination(place){
    chosen=valid(place?.latitude,place?.longitude)?
      {name:String(place.name||'Destination').slice(0,120),
        latitude:place.latitude,longitude:place.longitude,country:String(place.country||''),
        type:'destination'}:null;
    locations={airports:[],hotels:[]};
    renderInsights();
    focus=null;
    section.hidden=!chosen;
    placeholder(chosen?'Choose a mapped airport, hotel or destination. Map tiles load only when you open the map.':
      'Select a source-backed location first.');
    if(chosen)focusOn(chosen);
    renderPins();
  }
  function renderInsights(){
    const root=$('wf-map-insights');if(!root)return;
    root.replaceChildren();
    const nearest=locations.airports.filter(x=>typeof x.distanceKm==='number'&&
      Number.isFinite(x.distanceKm)&&x.distanceKm>=0).sort((a,b)=>a.distanceKm-b.distanceKm)[0];
    const facts=[
      ['GROUND CONTEXT',nearest?nearest.name+' · '+nearest.distanceKm.toFixed(1)+' km straight-line':'No mapped airport reference'],
      ['MAPPED STAYS',locations.hotels.length+' sourced hotel locations'],
      ['FARE VERIFICATION','Flight times and prices require an authorized provider search']
    ];
    for(const [title,value] of facts){
      const card=document.createElement('div');card.className='wf-map-insight';
      const name=document.createElement('span');name.textContent=title;
      const detail=document.createElement('strong');detail.textContent=value;
      card.append(name,detail);root.append(card);
    }
  }
  function setNearby(data){
    if(!chosen)return;
    const clean=arr=>Array.isArray(arr)?arr.filter(x=>valid(x?.latitude,x?.longitude)&&
      typeof x.name==='string'&&x.name.trim()).slice(0,10):[];
    locations={airports:clean(data?.airports),hotels:clean(data?.hotels)};
    renderPins();renderInsights();
    status.textContent='Select a pin to focus the map. '+locations.airports.length+
      ' airport references and '+locations.hotels.length+
      ' mapped hotel references available. Prices and routes require separate verification.';
  }
  launch.addEventListener('click',()=>{if(focus)iframe();});
  hide.addEventListener('click',()=>{placeholder('Map paused. Open it again whenever you want to explore.');
    if(focus)focusOn(focus);});
  mode.addEventListener('change',()=>{if(initialized)iframe();});
  placeholder('Choose a destination to explore the surrounding region.');
  section.hidden=true;
  window.WayfarerMap=Object.freeze({selectDestination,setNearby,focusOn});
})();
