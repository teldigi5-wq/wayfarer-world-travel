// Exact immutable artifact and network safety policy for INCIDENT browser checks.
// No user accounts, real API calls, external assets, bookings or paid providers.
export const INCIDENT_BROWSER_ORIGIN=
  'https://wayfarer-world-travel-m4ce3pzyx-teldigi5-wq.vercel.app';
export const PROFILES=Object.freeze([
  {name:'phone-320',width:320,height:720},
  {name:'phone-390',width:390,height:844},
  {name:'tablet-768',width:768,height:1024},
  {name:'desktop-1440',width:1440,height:900}
]);

export function validateIncidentBrowserOrigin(value){
  if(value!==INCIDENT_BROWSER_ORIGIN){
    throw Error('BLOCKED: immutable incident deployment origin mismatch');
  }
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||
    u.pathname!=='/'||u.search||u.hash||u.origin!==value){
    throw Error('BLOCKED: incident browser target cannot contain credentials, paths, or query data');
  }
  return u;
}

export function classifyIncidentBrowserRequest(raw,method='GET'){
  let u;
  try{u=new URL(raw)}catch{return 'block-invalid'}
  if(u.origin!==INCIDENT_BROWSER_ORIGIN)return 'block-external';
  // Treat encoded route separators and encoded API paths as API traffic too.
  let path;
  try{path=decodeURIComponent(u.pathname).replace(/\\/g,'/');}
  catch{return 'block-invalid'}
  if(path==='/api'||path.startsWith('/api/')||
     path.includes('/../')||path.includes('/./'))return 'block-api';
  if(!['GET','HEAD'].includes(method))return 'block-mutation';
  if(u.username||u.password)return 'block-credentials';
  return 'allow-static';
}
