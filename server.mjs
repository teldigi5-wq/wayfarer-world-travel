import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Preview-like, LOCAL-ONLY static test server. Vercel still owns production routing.
const types={
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
  '.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'
};
const config=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url),'utf8'));
const shared=config.headers?.find(rule=>rule.source==='/(.*)')?.headers;
if(!Array.isArray(shared)||!shared.length)throw Error('Missing Vercel security headers');
const securityHeaders=Object.fromEntries(shared.map(entry=>[entry.key,entry.value]));
const dataCache=config.headers?.find(rule=>rule.source==='/data.json')?.headers
  ?.find(item=>item.key.toLowerCase()==='cache-control')?.value;

http.createServer(async(req,res)=>{
  const headers={...securityHeaders,'X-Content-Type-Options':'nosniff'};
  try {
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{...headers,'Allow':'GET, HEAD','Cache-Control':'no-store'});
      return res.end();
    }
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=pathname==='/'?'index.html':pathname.slice(1);
    if(!/^[a-zA-Z0-9_.-]+$/.test(file)||file.startsWith('.'))throw Error('No matching local asset');
    const content=await readFile(new URL(file,import.meta.url));
    const extension=path.extname(file).toLowerCase();
    const responseHeaders={...headers,
      'Content-Type':types[extension]||'application/octet-stream',
      'Content-Length':content.byteLength
    };
    if(file==='data.json'&&dataCache)responseHeaders['Cache-Control']=dataCache;
    res.writeHead(200,responseHeaders);
    res.end(req.method==='HEAD'?undefined:content);
  }catch {
    res.writeHead(404,{...headers,'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'});
    res.end(req.method==='HEAD'?undefined:'Not found');
  }
}).listen((()=>{
  const port=Number(process.env.WAYFARER_LOCAL_PORT||4173);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
  return port;
})(),'127.0.0.1');
