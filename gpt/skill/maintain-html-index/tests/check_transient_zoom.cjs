// Deterministic interaction/timer checks, not a browser rendering test.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const skill=path.resolve(__dirname,'..'),root=path.resolve(process.argv[2]);
const records=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).files;
const record=records.find(r=>r.type==='md');
const d=new JSDOM(fs.readFileSync(path.join(root,decodeURIComponent(process.argv[3]||record.preview)),'utf8'),{url:'https://offline-test.invalid/preview.html',runScripts:'outside-only',pretendToBeVisual:true});
(async()=>{try{
 const w=d.window,doc=w.document;w.scrollTo=()=>{};
 const timers=new Map();let id=0;
 w.setTimeout=(fn,delay)=>{assert.equal(delay,3000);timers.set(++id,fn);return id;};w.clearTimeout=id=>timers.delete(id);
 const tick=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(f=>f());};
 w.eval(fs.readFileSync(path.join(skill,'assets/page-zoom.js'),'utf8'));
 const ui=doc.querySelector('.page-zoom-floating'),plus=ui.querySelector('[data-scale-action="in"]'),reset=ui.querySelector('.page-scale');
 const shown=()=>ui.classList.contains('is-visible');
 assert.equal(ui.parentElement,doc.documentElement);assert(!shown()&&ui.inert);assert.equal(timers.size,0);
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true}));
 assert(shown()&&!ui.inert);assert.equal(reset.textContent,'110%');assert.equal(timers.size,1);
 plus.click();assert.equal(reset.textContent,'125%');assert.equal(timers.size,1);tick();assert(!shown()&&ui.inert);assert.equal(ui.getAttribute('aria-hidden'),'true');
 doc.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-10,ctrlKey:true,bubbles:true,cancelable:true}));assert(shown());
 ui.dispatchEvent(new w.Event('pointerenter'));assert.equal(timers.size,0);tick();assert(shown());
 reset.click();assert.equal(reset.textContent,'100%');assert.equal(timers.size,0);
 ui.dispatchEvent(new w.Event('pointerleave'));assert.equal(timers.size,1);
 plus.focus();assert.equal(timers.size,0);tick();assert(shown());plus.click();assert.equal(timers.size,0);
 plus.blur();await Promise.resolve();assert.equal(timers.size,1);tick();assert(!shown());
 // Real pointer clicks focus buttons; .click() alone does not reproduce that bug.
 for(const button of [plus,reset,ui.querySelector('[data-scale-action="out"]')]){
  doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true}));
  ui.dispatchEvent(new w.Event('pointerenter'));button.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));button.focus();button.click();
  assert.equal(doc.activeElement,button);ui.dispatchEvent(new w.Event('pointerleave'));
  assert.equal(timers.size,1,'pointer focus must not pin the zoom popup');button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'0',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(timers.size,1,'global zoom shortcuts do not convert stale mouse focus to keyboard focus');tick();assert(!shown());assert(!ui.contains(doc.activeElement));
  await Promise.resolve();assert.equal(timers.size,0,'hiding and blurring must not rearm a timer');
 }
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true}));
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));plus.focus();assert.equal(timers.size,0,'keyboard focus still keeps controls available');
 doc.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));assert.equal(timers.size,1,'switching from keyboard to pointer resumes timeout');tick();assert(!shown());
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true}));ui.dispatchEvent(new w.Event('pointerenter'));w.dispatchEvent(new w.Event('blur'));assert(!shown());
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true}));
 const touch=new w.Event('pointerenter');Object.defineProperty(touch,'pointerType',{value:'touch'});ui.dispatchEvent(touch);assert.equal(timers.size,1,'touch entry is not a persistent hover');
 const down=new w.Event('pointerdown',{bubbles:true});Object.defineProperty(down,'pointerType',{value:'touch'});reset.dispatchEvent(down);reset.focus();reset.click();assert.equal(timers.size,1);tick();assert(!shown());
 const script=doc.querySelector('script[src$="page-zoom.js"]');
 w.localStorage.setItem('file-index:page-scale:v1:'+new URL('.',script.src).href,'2');w.dispatchEvent(new w.Event('pageshow'));
 assert.equal(reset.textContent,'200%');assert(!shown(),'restoring a saved scale must not summon the popup');
 doc.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-10,metaKey:true,ctrlKey:true,bubbles:true,cancelable:true}));assert(!shown(),'Command-wheel remains untouched');
 doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'0',metaKey:true,bubbles:true,cancelable:true}));assert(shown());
 w.dispatchEvent(new w.Event('pagehide'));assert(!shown());assert.equal(timers.size,0);
 console.log('PASS: zoom popup appears on adjustment, hides after 3 seconds, renews on action, stays on hover/focus, restores quietly, and clears timers on page exit (DOM simulation).');
}finally{wClose();}})().catch(e=>{console.error(e);process.exitCode=1;});
function wClose(){d.window.close();}
