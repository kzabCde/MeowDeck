import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(ROOT,path),'utf8');
const files=[
 'src/web/design-system/tokens.css',
 'src/web/design-system/base.css',
 'src/web/design-system/controls.css',
 'src/web/scenes/title.css',
 'src/web/scenes/crazy-eights.css',
 'src/web/scenes/blackjack.css',
 'src/web/scenes/selection.css',
 'src/web/responsive.css'
];

test('CSS modules are explicitly loaded in a stable design-system-to-responsive order',()=>{
 const layout=source('src/app/layout.tsx');
 let previous=-1;
 for(const path of files){
   assert.ok(existsSync(resolve(ROOT,path)),`Missing CSS module ${path}`);
   const statement=`import '../web/${path.slice('src/web/'.length)}';`;
   const index=layout.indexOf(statement);
   assert.ok(index>previous,`Stylesheet import is absent or out of order: ${path}`);
   assert.equal(layout.split(statement).length,2,`CSS import must occur once: ${path}`);
   previous=index;
 }
 for(const obsolete of [
   'src/web/styles.css','src/web/art-direction.css',
   'src/web/blackjack.css','src/web/selection.css'
 ]){
   assert.equal(existsSync(resolve(ROOT,obsolete)),false,`Obsolete stylesheet remains: ${obsolete}`);
 }
});

test('each CSS concern has one semantic owner and no indirect import chain',()=>{
 const [tokens,base,controls,title,crazy,blackjack,selection,responsive]=files.map(source);
 assert.match(tokens,/--md-table:/);
 assert.match(tokens,/--md-motion-card:/);
 assert.match(controls,/\.pixel-button\s*\{/);
 assert.doesNotMatch(base,/(^|\n)\.pixel-button\s*\{/);
 assert.doesNotMatch(base,/\.menu-stage\s*\{|\.game-option\s*\{|\.difficulty-card\s*\{/);
 assert.match(title,/\.title-screen/);
 assert.match(crazy,/\.crazy-eights-room/);
 assert.match(blackjack,/\.blackjack-room/);
 assert.match(selection,/\.game-choices/);
 assert.match(selection,/\.selection-screen/);
 assert.match(responsive,/safe-area-inset/);
 for(const [i,css] of [tokens,base,controls,title,crazy,blackjack,selection,responsive].entries()){
   assert.doesNotMatch(css,/^\s*@import\s/m,`Unexpected CSS import in ${files[i]}`);
   assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,`Unbalanced rules in ${files[i]}`);
 }
});

test('semantic styling roots and backward-compatible markup aliases coexist',()=>{
 const screen=source('src/web/components/Screens.tsx');
 const table=source('src/web/components/GameTable.tsx');
 const blackjack=source('src/web/components/BlackjackGame.tsx');
 for(const cls of ['title-screen md4-title-screen','selection-screen game-choices md4-selection-page',
                    'selection-screen difficulty-screen md4-selection-page']){
   assert.ok(screen.includes(cls),`Missing semantic selection/title root: ${cls}`);
 }
 assert.match(table,/crazy-eights-room md4-cardroom/);
 assert.match(blackjack,/blackjack-room md5-blackjack/);
});

test('renaming layout CSS cannot alter original card or sprite URLs or saved game schemas',()=>{
 const cards=source('src/web/components/PixelCard.tsx');
 const mochi=source('src/web/components/Mochi.tsx');
 assert.match(cards,/cardImage\(card\.id, true\)/);
 assert.match(mochi,/useMochiAnimation/);
 assert.ok(existsSync(resolve(ROOT,'public/assets/meowdeck/cards/manifest.json')));
 assert.ok(existsSync(resolve(ROOT,'public/assets/meowdeck/mochi/animations.json')));
});
