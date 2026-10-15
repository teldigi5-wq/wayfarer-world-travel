/* Build-only static output staging for the Vercel "Other" framework.
 * Source root is not the public web root. Only allowlisted browser assets
 * appear in public/. Root-level api/ Vercel Functions stay in the source
 * repository and are NOT duplicated into the public static directory.
 *
 * All inputs are fixed checked-in filenames; reject links and nested paths.
 * No remote fetch, shell commands, environment reads or paid providers.
 */
import {lstat,readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {PUBLIC_STATIC_FILES,PUBLIC_STATIC_SET} from '../public-static-assets.mjs';

const root=new URL('../',import.meta.url);
const destination=new URL('../public/',import.meta.url);
export async function stagePublicAssets(){
  if(PUBLIC_STATIC_FILES.length!==PUBLIC_STATIC_SET.size||PUBLIC_STATIC_FILES.length<20)
    throw Error('Static manifest must be nonempty, unique and reviewed');
  const inputs=[];
  for(const name of PUBLIC_STATIC_FILES){
    if(typeof name!=='string'||!/^[A-Za-z0-9_.-]+$/.test(name)||name.startsWith('.'))
      throw Error('Unsafe public filename declared');
    const source=new URL('../'+name,import.meta.url);
    const meta=await lstat(source);
    if(!meta.isFile()||meta.isSymbolicLink()||meta.size===0||
      meta.size>5_000_000)throw Error('Invalid public asset: '+name);
    inputs.push({name,content:await readFile(source)});
  }
  // A root-level public/ directory is the only static output. Start clean so
  // a removed manifest entry cannot survive as stale public content.
  await rm(destination,{recursive:true,force:true});
  await mkdir(destination,{recursive:true});
  for(const file of inputs)await writeFile(
    new URL('../public/'+file.name,import.meta.url),file.content,{flag:'wx',mode:0o644});
  const staged=await readdir(destination);
  if(staged.length!==PUBLIC_STATIC_FILES.length||
    staged.some(file=>!PUBLIC_STATIC_SET.has(file)))
    throw Error('Generated static directory diverges from public asset manifest');
  process.stdout.write('Staged '+staged.length+
    ' reviewed browser assets into public/; no server implementation or API source is static.\n');
  return {directory:path.relative(fileURLToPath(root),fileURLToPath(destination)),files:staged};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await stagePublicAssets();
