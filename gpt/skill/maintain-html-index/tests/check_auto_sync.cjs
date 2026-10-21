'use strict';
const {JSDOM}=require('jsdom'),vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../assets/auto-sync.js'),'utf8');
function setup(){
 const dom=new JSDOM('<header class="reader-heading"></header><div id="editor" contenteditable="true"></div><script id="sync-config" type="application/json">{"version":1,"endpoint":"/_sync"}</script>',{url:'https://sync.invalid/reader'}),w=dom.window,doc=w.document;
 Object.defineProperty(doc,'visibilityState',{value:'visible',configurable:true});
 let timers=[],state={version:1,state:'ready'},reloads=0,fetches=0,busy=false,selection='',failed=false;
 w.fileIndexEditingBusy=()=>busy;w.getSelection=()=>selection;
 vm.runInNewContext(source,{window:w,document:doc,location:{pathname:'/reader',reload:()=>reloads++},sessionStorage:w.sessionStorage,scrollY:321,scrollTo(){},requestAnimationFrame:fn=>fn(),setTimeout:fn=>{timers.push(fn);return fn;},clearTimeout:fn=>{timers=timers.filter(f=>f!==fn);},fetch:async()=>{fetches++;if(failed)throw Error('offline');return {ok:true,json:async()=>state};}});
 return {w,doc,dom,get reloads(){return reloads;},get fetches(){return fetches;},set state(value){state=value;},set busy(value){busy=value;},set selection(value){selection=value;},set failed(value){failed=value;},async tick(){const fn=timers.shift();assert(fn);await fn();}};
}
(async()=>{
 const t=setup();await t.tick();assert.equal(t.reloads,0);t.state={version:2,state:'building'};await t.tick();assert.equal(t.reloads,0);
 t.state={version:2,state:'ready'};t.busy=true;await t.tick();assert.equal(t.reloads,0,'unsaved/active edits are never reloaded');
 t.busy=false;t.doc.querySelector('#editor').focus();await t.tick();assert.equal(t.reloads,0,'generic editable focus also protected');t.doc.activeElement.blur();
 t.selection='selected passage';await t.tick();assert.equal(t.reloads,0);t.selection='';
 await t.tick();assert.equal(t.reloads,1);assert.equal(t.w.sessionStorage.getItem('file-index:sync-scroll:/reader'),'321');t.dom.window.close();
 const u=setup();u.failed=true;await u.tick();assert(u.doc.querySelector('#sync-status').textContent.includes('未连接'));u.failed=false;u.state={version:1,state:'error'};await u.tick();assert(u.doc.querySelector('#sync-status').textContent.includes('重试'));u.state={version:1,state:'ready'};await u.tick();assert(!u.doc.querySelector('#sync-status'));
 Object.defineProperty(u.doc,'visibilityState',{value:'hidden',configurable:true});const before=u.fetches;await u.tick();assert.equal(u.fetches,before);u.dom.window.close();
 console.log('PASS: reload only on ready version change, editor/focus/selection protection, scroll saved, disconnected/error recovery and hidden-page pause (DOM simulation).');
})().catch(e=>{console.error(e);process.exitCode=1;});
