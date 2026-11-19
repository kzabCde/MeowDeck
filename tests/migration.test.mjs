import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source=path=>readFileSync(resolve(ROOT,path),'utf8');

// These are contract and source-structure tests, NOT substitutes for a live Next.js build.
test('App Router entry points replace Vite without replacing MeowDeck UI',()=>{
  assert.ok(source('src/app/layout.tsx').includes('export default function RootLayout'));
  assert.ok(source('src/app/page.tsx').includes('return <App />'));
  assert.ok(source('src/web/App.tsx').startsWith("'use client';"));
  for(const path of ['index.html','vite.config.ts','src/web/main.tsx','tsconfig.web.json']){
    assert.equal(existsSync(resolve(ROOT,path)),false,`Unexpected obsolete Vite entrypoint ${path}`);
  }
  const pkg=JSON.parse(source('package.json'));
  assert.ok(pkg.dependencies.next.startsWith('16.'),'Use pinned stable Next.js major');
  for(const name of ['vite','@vitejs/plugin-react']){
    assert.equal(pkg.devDependencies?.[name],undefined,`Vite dependency remains: ${name}`);
  }
  for(const script of Object.values(pkg.scripts))assert.doesNotMatch(script,/\bvite\b/);
});

test('original NodeNext engine compiler survives as standalone configuration',()=>{
  const engine=JSON.parse(source('tsconfig.engine.json'));
  const web=JSON.parse(source('tsconfig.json'));
  assert.equal(engine.compilerOptions.moduleResolution,'NodeNext');
  assert.equal(engine.compilerOptions.outDir,'dist');
  assert.equal(web.compilerOptions.moduleResolution,'bundler');
  assert.equal(web.compilerOptions.noEmit,true);
});

test('browser-only QA flags are gated to development and SSR initial state is deterministic',()=>{
  const app=source('src/web/App.tsx');
  assert.doesNotMatch(app,/import\.meta/);
  assert.match(app,/useState<GameSettingsV1>\(DEFAULT_SETTINGS\)/);
  assert.match(app,/useState\(false\)/); // stable initial system motion preference
  assert.match(app,/process\.env\.NODE_ENV === 'development'/);
  assert.match(app,/new URLSearchParams\(window\.location\.search\)/);
  assert.match(app,/const seed=process\.env\.NODE_ENV==='development'/);
  assert.match(app,/media\.addEventListener\('change'/);
});

test('Next App Router preserves original P0 public asset URLs',()=>{
  assert.match(source('src/web/game/assets.ts'),/\/assets\/meowdeck\/cards\//);
  assert.match(source('src/web/animation/mochi-loader.ts'),/\/assets\/meowdeck\/mochi\//);
  assert.ok(existsSync(resolve(ROOT,'public/assets/meowdeck/cards/manifest.json')));
  assert.ok(existsSync(resolve(ROOT,'public/assets/meowdeck/mochi/animations.json')));
  assert.match(source('src/web/design-system/base.css'),/image-rendering:pixelated/);
  assert.match(source('src/web/design-system/controls.css'),/image-rendering:pixelated/);
});

test('all 122 immutable P0 production image bytes match their SHA-256 digests',()=>{
  const digests=JSON.parse(source('asset-digests.json'));
  assert.equal(Object.keys(digests).length,122);
  for(const [path,digest] of Object.entries(digests)){
    const actual=createHash('sha256').update(readFileSync(resolve(ROOT,path))).digest('hex');
    assert.equal(actual,digest,`Art changed: ${path}`);
  }
});

test('production Playwright checks hydration and keeps seeded fixtures only in dev tests',()=>{
  const config=source('playwright.production.config.ts');
  assert.match(config,/npm run start/);
  assert.match(source('playwright.config.ts'),/npm run dev/);
  const testFile=source('e2e/production.spec.ts');
  assert.match(testFile,/pageerror/);
  assert.match(testFile,/assets\/meowdeck\/mochi\/animations\.json/);
  assert.match(testFile,/gameplay-screen/);
  const workflow=source('.github/workflows/validate-ui.yml');
  assert.match(workflow,/npm ci/);
  assert.match(workflow,/npm run test:e2e:production/);
});
