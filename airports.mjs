// Public-domain OurAirports country/airport discovery helpers. Not live service availability.
export const matchText = value => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').trim();
export function countrySuggestions(countries, query, max=12) {
  const q=matchText(query);
  if (!q) return [];
  return (Array.isArray(countries)?countries:[])
    .filter(c=>matchText(c.name).includes(q) || matchText(c.code)===q)
    .sort((a,b)=>{
      const aa=matchText(a.name),bb=matchText(b.name);
      return Number(!aa.startsWith(q))-Number(!bb.startsWith(q)) || aa.localeCompare(bb);
    }).slice(0,max);
}
export function airportOptions(airports, {country, query='', city='', max=60}={}) {
  const q=matchText(query);
  const cityText=matchText(city);
  const subset=(Array.isArray(airports)?airports:[]).filter(a=>{
    if (!a || !/^[A-Z]{3}$/.test(a.iata||'') || !/^[A-Z]{2}$/.test(a.code||''))return false;
    if (country && a.code!==country)return false;
    const hay=matchText([a.iata,a.name,a.municipality].join(' '));
    return !q || hay.includes(q);
  });
  return subset.sort((a,b)=>{
    const rank=a=>(
      (cityText && matchText(a.municipality).startsWith(cityText) ? 0 : cityText && matchText(a.name).includes(cityText) ? 1 : 2)*100 +
      (a.scheduledService===true || a.scheduledService==='yes'?0:15) +
      (a.type==='large_airport'?0:a.type==='medium_airport'?5:10)
    );
    return rank(a)-rank(b) || a.name.localeCompare(b.name);
  }).slice(0,max);
}
export function airportLabel(airport) {
  return [airport.iata,'—',airport.name,airport.municipality ? '· '+airport.municipality : '',airport.code]
    .filter(Boolean).join(' ');
}
export function validateSelectedAirport(code, airports, expectedCountry='') {
  if (!code)return '';
  const v=String(code).trim().toUpperCase();
  const matched=(Array.isArray(airports)?airports:[]).some(a=>a.iata===v && (!expectedCountry || a.code===expectedCountry));
  return matched?v:'';
}
