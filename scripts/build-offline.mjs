import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd();
const buildId=(await readFile(join(root,'.next/BUILD_ID'),'utf8')).trim();
const publicRoot=join(root,'public');
const urls=['/','/manifest.webmanifest'];
async function list(folder,base,filter=()=>true,prefix='/'){
  for(const item of await readdir(folder,{withFileTypes:true})){
    const path=join(folder,item.name);
    if(item.isDirectory())await list(path,base,filter,prefix);
    else if(item.isFile()&&filter(path))urls.push(prefix+relative(base,path).split(sep).join('/'));
  }
}
await list(join(root,'.next/static'),join(root,'.next'),p=>!p.endsWith('.map'),'/_next/');
await list(join(publicRoot,'assets/meowdeck'),publicRoot,p=>/\.(png|json)$/i.test(p));
await list(join(publicRoot,'icons'),publicRoot,p=>/\.png$/i.test(p));
// App Router manifest is served by Next at /manifest.webmanifest. Icon paths are public immutable assets.
const dedup=[...new Set(urls)].sort();
const version=createHash('sha256').update(buildId+'\n'+dedup.join('\n')).digest('hex').slice(0,16);
await writeFile(join(publicRoot,'offline-precache.json'),JSON.stringify({version,buildId,urls:dedup},null,2));
const template=await readFile(join(root,'scripts/sw.template.js'),'utf8');
await writeFile(join(publicRoot,'sw.js'),`// Build ${buildId}\nself.MEOW_BUILD_ID=${JSON.stringify(buildId)};\n`+template);
console.log(`Offline precache manifest v${version}: ${dedup.length} URLs`);
