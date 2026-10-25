// Deterministic, offline build: create the ONLY directory Vercel publishes.
// Reject arbitrary paths, symlinks, empty or oversized source files.
// Root api/ remains exclusively server-side (not in this public/ directory).
import {lstat,readFile,rm,mkdir,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {PUBLIC_ASSETS} from '../static-asset-manifest.mjs';

const root=new URL('../',import.meta.url);
const dest=new URL('../public/',import.meta.url);
const allowed=new Set(PUBLIC_ASSETS);
const syntax=/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

export async function stagePublicAssets(){
  if(PUBLIC_ASSETS.length<12||allowed.size!==PUBLIC_ASSETS.length)
    throw Error('Static asset manifest is missing or duplicated');
  const originals=[];
  for(const name of PUBLIC_ASSETS){
    if(typeof name!=='string'||!syntax.test(name)||name==='.'||name==='..')
      throw Error('Unsafe public filename');
    const source=new URL('../'+name,import.meta.url);
    const meta=await lstat(source);
    if(!meta.isFile()||meta.isSymbolicLink()||meta.size<=0||meta.size>5_000_000)
      throw Error('Invalid checked-in browser asset: '+name);
    originals.push({name,buffer:await readFile(source)});
  }

  // Do not leave obsolete files in the deployment output between builds.
  await rm(dest,{recursive:true,force:true});
  await mkdir(dest,{recursive:true});
  for(const {name,buffer} of originals)
    await writeFile(new URL('../public/'+name,import.meta.url),buffer,
      {flag:'wx',mode:0o644});
  const staged=await readdir(dest);
  if(staged.length!==PUBLIC_ASSETS.length||staged.some(name=>!allowed.has(name)))
    throw Error('Public output diverges from reviewed manifest');
  console.log('Created offline static build: '+PUBLIC_ASSETS.length+
    ' reviewed assets; no tests/scripts/docs/server source in public/');
  return {directory:path.relative(fileURLToPath(root),fileURLToPath(dest)),
    files:staged.sort()};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await stagePublicAssets();
