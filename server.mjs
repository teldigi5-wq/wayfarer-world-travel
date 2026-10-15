/* Local-only Wayfarer static preview.
 * Not a Vercel API simulator: real /api routes are intentionally absent.
 * Never expose repository config, server implementations, tests, docs,
 * private workflow paths, or provider secrets via a catch-all file server.
 */
import http from 'node:http';
import {readFile,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PUBLIC_STATIC_SET} from './public-static-assets.mjs';

const types={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'
};
const config=JSON.parse(readFileSync(new URL('./vercel.json',import.meta.url),'utf8'));
const globalHeaders=Object.fromEntries(
  (config.headers.find(entry=>entry.source==='/(.*)')?.headers||[])
    .map(({key,value})=>[key,value])
);
const publicData=new Set(['data.json','airports-index.json']);
const headersFor=(file)=>({
  ...globalHeaders,
  'Content-Type':types[path.extname(file)]||'application/octet-stream',
  'Cache-Control':publicData.has(file)?'public, max-age=86400':
    file.endsWith('.html')?'no-store':'no-cache'
});
const reject=(res,status,message,extra={})=>{
  res.writeHead(status,{
    ...globalHeaders,
    'Content-Type':'text/plain; charset=utf-8',
    'Cache-Control':'no-store',...extra
  });
  res.end(message);
};
export function createStaticServer(){
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){
      reject(res,405,'Method not allowed',{'Allow':'GET, HEAD'});return;
    }
    if(!req.url||req.url.length>2048){
      reject(res,414,'Request target too long');return;
    }
    let file;
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      file=pathname==='/'?'index.html':pathname.slice(1);
    }catch{
      reject(res,400,'Malformed request URL');return;
    }
    // No URLs to nested directories, no dynamic parent traversal, no dotfiles,
    // no .mjs server code, and no repository fallthrough after a missing asset.
    if(!/^[a-zA-Z0-9_.-]+$/.test(file)||
      file.startsWith('.')||!PUBLIC_STATIC_SET.has(file)){
      reject(res,404,'Not found');return;
    }
    try{
      const data=await new Promise((resolve,rejectRead)=>
        readFile(new URL(file,import.meta.url),(error,bytes)=>
          error?rejectRead(error):resolve(bytes))
      );
      res.writeHead(200,{...headersFor(file),'Content-Length':data.length});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{
      reject(res,404,'Not found');
    }
  });
  server.headersTimeout=10000;
  server.requestTimeout=10000;
  server.maxHeadersCount=64;
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createStaticServer().listen(4173,'127.0.0.1',()=>{
    process.stdout.write(
      'Wayfarer local static preview at http://127.0.0.1:4173 (no API emulation).\n'
    );
  });
}
