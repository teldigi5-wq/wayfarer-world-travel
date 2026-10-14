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
    const radius=span==='region'?.42:.075;
    return [Math.max(-180,lon-radius),Math.max(-90,lat-radius),
      Math.min(180,lon+radius),Math.min(90,lat+radius)].join(',');
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
    frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.setAttribute('allowfullscreen','');
    frame.src=src.href;
    viewport.replaceChildren(frame);
    status.textContent='Interactive OpenStreetMap centered on '+focus.name+
      '. Mapped locations are reference points, not verified driving routes.';
    initialized=true;hide.hidden=false;launch.hidden=true;
  }
  function focusOn(item,open=false){
    if(!valid(item?.latitude,item?.longitude))return false;
    focus={name:String(item.name||'Mapped place').slice(0,120),
      latitude:item.latitude,longitude:item.longitude};
    label.textContent=focus.name;links(focus);
    pins.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',
      b.dataset.place===item.type+':'+focus.name?'true':'false'));
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
    for(const entry of entries){
      if(!valid(entry.latitude,entry.longitude))continue;
      const key=entry.type+':'+entry.name;
      if(known.has(key))continue;
      known.add(key);
      const button=document.createElement('button');button.type='button';
      button.className='wf-map-pin';
      button.dataset.place=key;
      button.setAttribute('aria-pressed',String(focus?.name===entry.name));
      const icon=document.createElement('span');icon.className='wf-map-dot';
      const text=document.createElement('span');
      const name=document.createElement('strong');name.textContent=entry.name;
      const kind=document.createElement('small');
      kind.textContent=entry.type==='airport'?'Airport reference':
        entry.type==='hotel'?'Mapped hotel reference':'Chosen destination';
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
    focus=null;
    section.hidden=!chosen;
    placeholder(chosen?'Choose a mapped airport, hotel or destination. Map tiles load only when you open the map.':
      'Select a source-backed location first.');
    if(chosen)focusOn(chosen);
    renderPins();
  }
  function setNearby(data){
    if(!chosen)return;
    const clean=arr=>Array.isArray(arr)?arr.filter(x=>valid(x?.latitude,x?.longitude)&&
      typeof x.name==='string'&&x.name.trim()).slice(0,10):[];
    locations={airports:clean(data?.airports),hotels:clean(data?.hotels)};
    renderPins();
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
