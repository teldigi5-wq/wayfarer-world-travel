/* Zero-network flight segment consistency validation.
   Public provider responses can contain unrelated flights or incomplete
   stopover segments. Never turn these into a selectable itinerary. */
const iata=v=>typeof v==='string'&&/^[A-Z]{3}$/.test(v);
export function verifiedSegmentRoute(segments,origin,destination,{maxSegments=6}={}){
  if(!iata(origin)||!iata(destination)||origin===destination||
     !Array.isArray(segments)||segments.length<1||segments.length>maxSegments)return false;
  for(let i=0;i<segments.length;i++){
    const f=segments[i];
    if(!f||!iata(f.from)||!iata(f.to)||f.from===f.to)return false;
    if(i>0&&segments[i-1].to!==f.from)return false;
  }
  return segments[0].from===origin&&segments.at(-1).to===destination;
}
