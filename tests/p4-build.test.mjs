import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('P4 postbuild manifest rewrites real Next build static chunks to /_next/static URLs',()=>{
 const root=mkdtempSync(join(tmpdir(),'meowdeck-offline-fixture-'));
 try{
   for(const dir of ['.next/static/chunks','scripts','public/assets/meowdeck/cards','public/icons'])mkdirSync(join(root,dir),{recursive:true});
   writeFileSync(join(root,'.next/BUILD_ID'),'fixture-build-123');
   writeFileSync(join(root,'.next/static/chunks/demo.js'),'console.log("demo")');
   writeFileSync(join(root,'public/assets/meowdeck/cards/manifest.json'),'{}');
   writeFileSync(join(root,'public/icons/meowdeck-192.png'),'fixture');
   for(const name of ['build-offline.mjs','sw.template.js'])copyFileSync(resolve('scripts',name),join(root,'scripts',name));
   const proc=spawnSync(process.execPath,['scripts/build-offline.mjs'],{cwd:root,encoding:'utf8'});
   assert.equal(proc.status,0,proc.stderr);
   const manifest=JSON.parse(readFileSync(join(root,'public/offline-precache.json'),'utf8'));
   assert.equal(manifest.buildId,'fixture-build-123');
   for(const path of ['/', '/manifest.webmanifest','/_next/static/chunks/demo.js','/assets/meowdeck/cards/manifest.json','/icons/meowdeck-192.png'])assert.ok(manifest.urls.includes(path),path);
   assert.ok(!manifest.urls.includes('/static/chunks/demo.js'),'Next assets must use the /_next prefix');
   const sw=readFileSync(join(root,'public/sw.js'),'utf8');assert.match(sw,/self.MEOW_BUILD_ID="fixture-build-123"/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
