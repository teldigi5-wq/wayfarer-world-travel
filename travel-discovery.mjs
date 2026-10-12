import {countrySuggestions,airportOptions,airportLabel} from './airports.mjs';
const $=id=>document.getElementById(id);
const countriesInput=$('country-search');
const countrySelect=$('country');
const originSearch=$('origin-airport-search');
const originSelect=$('origin-airport');
const destSearch=$('destination-airport-search');
const destSelect=$('destination-airport');
const hint=$('airport-data-status');
const list=$('country-suggestion-buttons');

async function loadAirports() {
  const fallback=await fetch('./data.json').then(r=>{if(!r.ok)throw Error('Country dataset unavailable');return r.json();});
  let catalog=fallback.airports||[], retrieved=fallback.retrieved, mode='curated sample';
  try {
    const res=await fetch('./airports-index.json');
    if (res.ok) {
      const value=await res.json();
      if(Array.isArray(value.airports) && value.airports.length>=1000) {
        catalog=value.airports;
        retrieved=value.retrievedAt||null;
        mode='published international airport directory';
      }
    }
  } catch { /* bundled sample remains usable */ }
  return {countries:fallback.countries||[],cities:fallback.cities||[],airports:catalog,retrieved,mode};
}
const dataset=await loadAirports().catch(()=>null);
if (!dataset) {
  if (hint)hint.textContent='Airport directory is unavailable. Enter departure city and destination as usual.';
} else {
  const {countries,cities,airports,retrieved,mode}=dataset;
  if(hint)hint.textContent=airports.length.toLocaleString()+' known IATA-coded airport entries · '+mode+' · data checked: '+(retrieved||'date unrecorded')+'. Airport listing is not live flight service confirmation.';
  const countryCode=()=>countries.find(c=>c.name===countrySelect?.value)?.code||'';
  function setOptions(select,options,current,placeholder){
    if(!select)return;
    select.replaceChildren();
    const empty=document.createElement('option');empty.value='';empty.textContent=placeholder;select.append(empty);
    for(const airport of options){
      const opt=document.createElement('option');
      opt.value=airport.iata;opt.textContent=airportLabel(airport);
      select.append(opt);
    }
    if(options.some(a=>a.iata===current))select.value=current;
    else select.value='';
  }
  function refreshOrigin(){
    const current=originSelect.value,query=originSearch.value.trim()||$('trip-form').elements.namedItem('origin')?.value.trim()||'';
    const options=airportOptions(airports,{query, max:60});
    setOptions(originSelect,options,current,options.length?'Select departure airport (IATA)':'No matching airports; change search');
  }
  function refreshDestination(){
    const current=destSelect.value;
    const code=countryCode();
    const city=$('city')?.value||'';
    const options=airportOptions(airports,{country:code,query:destSearch.value,max:120,city});
    setOptions(destSelect,options,current,options.length?'Select arrival airport (IATA)':'No matching airports for this country');
  }
  function refreshCountries() {
    if(!list)return;
    list.replaceChildren();
    const matches=countrySuggestions(countries,countriesInput.value,8);
    for(const c of matches){
      const button=document.createElement('button');
      button.type='button';
      button.className='country-suggestion';
      button.textContent=c.name;
      button.addEventListener('click',()=>{
        countriesInput.value=c.name;
        countriesInput.dispatchEvent(new Event('input',{bubbles:true}));
        countrySelect.value=c.name;
        countrySelect.dispatchEvent(new Event('change',{bubbles:true}));
        list.replaceChildren();
        $('city').focus();
      });
      list.append(button);
    }
  }
  countriesInput.addEventListener('input',refreshCountries);
  countriesInput.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'&&list.firstElementChild){
      event.preventDefault();list.firstElementChild.focus();
    }
    if(event.key==='Escape')list.replaceChildren();
  });
  list.addEventListener('keydown',event=>{
    if(event.key==='Escape'){list.replaceChildren();countriesInput.focus();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();const buttons=[...list.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
      buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
    }
  });
  countrySelect?.addEventListener('change',()=>{
    destSelect.value='';destSearch.value='';refreshDestination();
  });
  $('city')?.addEventListener('change',refreshDestination);
  $('city')?.addEventListener('input',refreshDestination);
  originSearch?.addEventListener('input',refreshOrigin);
  destSearch?.addEventListener('input',refreshDestination);
  $('trip-form').elements.namedItem('origin')?.addEventListener('change',refreshOrigin);
  originSelect?.addEventListener('change',()=>{
    const airport=airports.find(a=>a.iata===originSelect.value);
    const origin=$('trip-form').elements.namedItem('origin');
    if(airport && !origin.value.trim())origin.value=airport.municipality||airport.name;
  });
  $('trip-form')?.addEventListener('reset',()=>{
    requestAnimationFrame(()=>{refreshOrigin();refreshDestination();});
  });
  let attempt=0;
  const init=()=>{
    if(countrySelect?.options.length>1 && countrySelect.value){
      refreshOrigin();refreshDestination();return;
    }
    if(++attempt<=12)setTimeout(init,200);
  };
  init();
}
